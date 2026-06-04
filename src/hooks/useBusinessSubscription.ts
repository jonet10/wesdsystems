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

export function useBusinessSubscription() {
  const { profile, isAuthenticated } = useAuth();
  const businessId = profile?.business_id ?? null;

  const subscriptionQuery = useQuery({
    queryKey: ["business-subscription", businessId],
    enabled: Boolean(isAuthenticated && businessId),
    queryFn: async (): Promise<BusinessSubscriptionState> => {
      if (!businessId) {
        return {
          plan: null,
          subscription: null,
          features: [],
          maxBranches: null,
          maxStaff: null,
          isActive: false,
        };
      }

      const { data: rawSubscriptions } = await supabase
        .from("business_subscriptions")
        .select("id, business_id, plan_id, start_date, end_date, status, billing_cycle, auto_renew, price_snapshot, currency_code, notes")
        .eq("business_id", businessId)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1);

      let subscription = (rawSubscriptions?.[0] as BusinessSubscription | null) ?? null;

      if (subscription && subscription.end_date && new Date(subscription.end_date) < new Date()) {
        await supabase
          .from("business_subscriptions")
          .update({ status: "expired" })
          .eq("id", subscription.id);

        subscription = { ...subscription, status: "expired" as const };
      }

      subscription = subscription?.status && !["expired", "cancelled"].includes(subscription.status) ? subscription : null;
      const planId = subscription?.plan_id ?? null;

      let plan: SubscriptionPlan | null = null;
      let features: SubscriptionFeature[] = [];

      if (planId) {
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
      }

      if (!plan) {
        const { data: businessRow } = await supabase
          .from("businesses")
          .select("plan_id")
          .eq("id", businessId)
          .maybeSingle();

        const fallbackPlanId = businessRow?.plan_id ?? null;
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

      return {
        plan,
        subscription,
        features,
        maxBranches: plan?.max_branches ?? defaultLimits.maxBranches,
        maxStaff: plan?.max_staff ?? defaultLimits.maxStaff,
        isActive: Boolean(subscription && subscription.status && !["expired", "cancelled"].includes(subscription.status) && plan?.active !== false),
      };
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
