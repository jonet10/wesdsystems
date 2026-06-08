import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { BusinessSubscription, SubscriptionFeature, SubscriptionPlan } from "@/lib/saas";
import { getDefaultPlanLimits, normalizePlanName } from "@/lib/saas";

export interface BusinessSubscriptionState {
  plan: SubscriptionPlan | null;
  subscription: BusinessSubscription | null;
  features: SubscriptionFeature[];
  maxBranches: number | null;
  maxStaff: number | null;
  isActive: boolean;
}

type NumericPlanRow = SubscriptionPlan & {
  monthly_price: number | string;
  yearly_price: number | string;
  max_businesses: number | string | null;
  max_branches: number | string | null;
  max_staff: number | string | null;
};

function isEndDatePassed(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  const end = new Date(endDate + "T23:59:59");
  const now = new Date();
  const passed = end < now;
  console.log(`[useBusinessSubscription] isEndDatePassed check: end=${endDate} (parsed=${end.toISOString()}), now=${now.toISOString()}, passed=${passed}`);
  return passed;
}

export function useBusinessSubscription() {
  const { profile, isAuthenticated } = useAuth();
  const businessId = profile?.business_id ?? null;

  const subscriptionQuery = useQuery({
    queryKey: ["business-subscription", businessId],
    enabled: Boolean(isAuthenticated && businessId),
    queryFn: async (): Promise<BusinessSubscriptionState> => {
      if (!businessId) {
        console.log("[useBusinessSubscription] No businessId, returning inactive");
        return {
          plan: null,
          subscription: null,
          features: [],
          maxBranches: null,
          maxStaff: null,
          isActive: false,
        };
      }

      console.log(`[useBusinessSubscription] Loading subscription for businessId=${businessId}`);

      const { data: rawSubscriptions, error: subError } = await supabase
        .from("business_subscriptions")
        .select("id, business_id, plan_id, start_date, end_date, status, billing_cycle, auto_renew, price_snapshot, currency_code, notes")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (subError) {
        console.error("[useBusinessSubscription] Error loading subscriptions:", subError);
        throw subError;
      }

      console.log(`[useBusinessSubscription] Found ${rawSubscriptions?.length || 0} subscription rows`);

      const statusPriority: Record<string, number> = { active: 0, trialing: 1, past_due: 2, expired: 3 };
      const subscriptions = ((rawSubscriptions || []) as BusinessSubscription[]).filter(s => s.status in statusPriority);
      const sorted = subscriptions.sort((a, b) => {
        const pa = statusPriority[a.status] ?? 99;
        const pb = statusPriority[b.status] ?? 99;
        if (pa !== pb) return pa - pb;
        if (a.end_date && !b.end_date) return -1;
        if (!a.end_date && b.end_date) return 1;
        return 0;
      });

      let subscription = sorted[0] ?? null;

      if (subscription) {
        console.log(`[useBusinessSubscription] Selected subscription: id=${subscription.id}, status=${subscription.status}, end_date=${subscription.end_date}, plan_id=${subscription.plan_id}`);
      } else {
        console.log(`[useBusinessSubscription] No subscription found (had ${rawSubscriptions?.length} rows, ${subscriptions.length} after filter)`);
      }

      const endDatePassed = isEndDatePassed(subscription?.end_date);

      // Auto-expire if end_date has passed
      if (subscription && endDatePassed && subscription.status !== "expired") {
        console.log(`[useBusinessSubscription] End date passed for ${subscription.id}, setting status to expired`);
        await supabase
          .from("business_subscriptions")
          .update({ status: "expired" })
          .eq("id", subscription.id);
        subscription = { ...subscription, status: "expired" as const };
      }

      // Recover if status=expired but end_date hasn't passed (wrong previous auto-expire)
      if (subscription && subscription.status === "expired" && !endDatePassed) {
        console.log(`[useBusinessSubscription] Subscription ${subscription.id} is expired but end_date hasn't passed, recovering to active`);
        await supabase
          .from("business_subscriptions")
          .update({ status: "active" })
          .eq("id", subscription.id);
        subscription = { ...subscription, status: "active" as const };
      }

      const isSubscriptionActive =
        (subscription?.status === "active" && !endDatePassed) ||
        (subscription?.status === "trialing" && !endDatePassed) ||
        (subscription?.status === "past_due" && !endDatePassed) ||
        (subscription?.status === "expired" && !endDatePassed) ||
        // No end_date set → never expires (e.g. lifetime subscription)
        Boolean(subscription?.status === "active" && !subscription?.end_date);

      console.log(`[useBusinessSubscription] isSubscriptionActive=${isSubscriptionActive} (status=${subscription?.status}, endDatePassed=${endDatePassed})`);

      subscription = subscription?.status && isSubscriptionActive ? subscription : null;

      const planId = subscription?.plan_id ?? null;

      let plan: SubscriptionPlan | null = null;
      let features: SubscriptionFeature[] = [];

      if (planId) {
        console.log(`[useBusinessSubscription] Loading plan ${planId}`);
        const [{ data: planRow }, { data: featureRows }] = await Promise.all([
          supabase
            .from("subscription_plans")
            .select("id, name, monthly_price, yearly_price, max_businesses, max_branches, max_staff, active, description")
            .eq("id", planId)
            .maybeSingle(),
          supabase
            .from("subscription_features")
            .select("id, plan_id, feature_key, enabled, feature_label, feature_group, sort_order")
            .eq("plan_id", planId)
            .order("sort_order", { ascending: true }),
        ]);

        plan = planRow
          ? {
              ...(planRow as NumericPlanRow),
              monthly_price: Number(planRow.monthly_price || 0),
              yearly_price: Number(planRow.yearly_price || 0),
              max_businesses: planRow.max_businesses === null ? null : Number(planRow.max_businesses),
              max_branches: planRow.max_branches === null ? null : Number(planRow.max_branches),
              max_staff: planRow.max_staff === null ? null : Number(planRow.max_staff),
            }
          : null;
        features = (featureRows || []) as SubscriptionFeature[];

        if (plan) {
          console.log(`[useBusinessSubscription] Found plan: id=${plan.id}, name=${plan.name}, active=${plan.active}`);
        } else {
          console.log(`[useBusinessSubscription] No plan found for id=${planId}`);
        }
      }

      if (!plan) {
        const { data: businessRow } = await supabase
          .from("businesses")
          .select("plan_id")
          .eq("id", businessId)
          .maybeSingle();

        const fallbackPlanId = businessRow?.plan_id ?? null;
        console.log(`[useBusinessSubscription] Fallback: business.plan_id=${fallbackPlanId}`);

        if (fallbackPlanId) {
          const [{ data: fallbackPlanRow }, { data: featureRows }] = await Promise.all([
            supabase
              .from("subscription_plans")
              .select("id, name, monthly_price, yearly_price, max_businesses, max_branches, max_staff, active, description")
              .eq("id", fallbackPlanId)
              .maybeSingle(),
            supabase
              .from("subscription_features")
              .select("id, plan_id, feature_key, enabled, feature_label, feature_group, sort_order")
              .eq("plan_id", fallbackPlanId)
              .order("sort_order", { ascending: true }),
          ]);

          plan = fallbackPlanRow
            ? {
                ...(fallbackPlanRow as NumericPlanRow),
                monthly_price: Number(fallbackPlanRow.monthly_price || 0),
                yearly_price: Number(fallbackPlanRow.yearly_price || 0),
                max_businesses: fallbackPlanRow.max_businesses === null ? null : Number(fallbackPlanRow.max_businesses),
                max_branches: fallbackPlanRow.max_branches === null ? null : Number(fallbackPlanRow.max_branches),
                max_staff: fallbackPlanRow.max_staff === null ? null : Number(fallbackPlanRow.max_staff),
              }
            : null;
          features = (featureRows || []) as SubscriptionFeature[];
        }
      }

      const defaultLimits = getDefaultPlanLimits(plan?.name || "");

      const result: BusinessSubscriptionState = {
        plan,
        subscription,
        features,
        maxBranches: plan?.max_branches ?? defaultLimits.maxBranches,
        maxStaff: plan?.max_staff ?? defaultLimits.maxStaff,
        isActive: Boolean(subscription && isSubscriptionActive && plan?.active !== false),
      };

      console.log(`[useBusinessSubscription] Final state: isActive=${result.isActive}, hasSubscription=${!!subscription}, hasPlan=${!!plan}, planActive=${plan?.active}`);

      return result;
    },
  });

  const featureMap = useMemo(() => {
    const map = new Map<string, boolean>();
    subscriptionQuery.data?.features.forEach((feature) => {
      map.set(feature.feature_key, feature.enabled);
    });
    return map;
  }, [subscriptionQuery.data?.features]);

  return {
    ...subscriptionQuery,
    featureMap,
    hasFeature: (featureKey: string) => featureMap.get(featureKey) === true,
  };
}
