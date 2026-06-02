import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { buildMonCashSubscriptionPaymentLink } from "@/lib/moncash";

type SubscriptionRow = {
  id: string;
  business_id: string;
  plan_id: string;
  status: "active" | "trialing" | "past_due" | "expired" | "cancelled" | string;
  billing_cycle: "monthly" | "yearly" | "custom" | null;
  end_date: string | null;
  created_at: string;
};

type BusinessRow = {
  id: string;
  name: string | null;
  plan_id: string | null;
  currency_code: string | null;
};

type PlanRow = {
  id: string;
  name: string;
  monthly_price: number | string | null;
  yearly_price: number | string | null;
  active: boolean;
};

export type SubscriptionPaymentReminder = {
  shouldPrompt: boolean;
  storageKey: string;
  title: string;
  description: string;
  ctaLabel: string;
  paymentUrl: string | null;
  businessName: string;
  planName: string | null;
  statusLabel: string;
  daysRemaining: number | null;
  loading: boolean;
};

const formatDaysRemaining = (daysRemaining: number | null) => {
  if (daysRemaining === null) return null;
  if (daysRemaining <= 0) return "aujourd'hui";
  if (daysRemaining === 1) return "dans 1 jour";
  return `dans ${daysRemaining} jours`;
};

export function useSubscriptionPaymentReminder(): SubscriptionPaymentReminder {
  const { profile, isAuthenticated } = useAuth();
  const businessId = profile?.business_id ?? null;
  const isBusinessOwner = profile?.role === "salon_admin" || profile?.role === "bar_admin";

  const query = useQuery({
    queryKey: ["subscription-payment-reminder", businessId],
    enabled: Boolean(isAuthenticated && businessId && isBusinessOwner),
    queryFn: async (): Promise<Omit<SubscriptionPaymentReminder, "loading"> | null> => {
      if (!businessId) return null;

      const { data: sessionData } = await supabase.auth.getSession();
      const loginSignature =
        sessionData.session?.user?.last_sign_in_at ||
        sessionData.session?.user?.created_at ||
        sessionData.session?.access_token?.slice(0, 12) ||
        "anonymous";

      const [{ data: businessData }, { data: subscriptionData }] = await Promise.all([
        supabase
          .from("businesses")
          .select("id, name, plan_id, currency_code")
          .eq("id", businessId)
          .maybeSingle(),
        supabase
          .from("business_subscriptions")
          .select("id, business_id, plan_id, status, billing_cycle, end_date, created_at")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const business = (businessData as BusinessRow | null) ?? null;
      const subscription = (subscriptionData as SubscriptionRow | null) ?? null;
      const planId = subscription?.plan_id ?? business?.plan_id ?? null;

      let plan: PlanRow | null = null;
      if (planId) {
        const { data: planData } = await supabase
          .from("subscription_plans")
          .select("id, name, monthly_price, yearly_price, active")
          .eq("id", planId)
          .maybeSingle();
        plan = (planData as PlanRow | null) ?? null;
      }

      const now = new Date();
      const endDate = subscription?.end_date ? new Date(`${subscription.end_date}T23:59:59`) : null;
      const daysRemaining = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const businessName = business?.name?.trim() || "Votre établissement";
      const planName = plan?.name ?? null;
      const billingCycle = subscription?.billing_cycle || "monthly";
      const amount = plan
        ? Number(billingCycle === "yearly" ? plan.yearly_price || 0 : plan.monthly_price || 0)
        : null;

      const isExpired = !subscription
        ? Boolean(planId)
        : subscription.status === "expired" ||
          subscription.status === "cancelled" ||
          (daysRemaining !== null && daysRemaining < 0);
      const isPastDue = subscription?.status === "past_due";
      const isTrialingSoon = subscription?.status === "trialing" && daysRemaining !== null && daysRemaining <= 7;
      const isExpiringSoon = subscription?.status === "active" && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;
      const shouldPrompt = Boolean(planId && (isExpired || isPastDue || isTrialingSoon || isExpiringSoon));

      const statusLabel = isPastDue
        ? "past_due"
        : isTrialingSoon
          ? "trialing"
          : isExpiringSoon
            ? "expiring"
            : isExpired
              ? "expired"
              : "active";

      const storageKey = `subscription-reminder:${businessId}:${subscription?.id || "no-subscription"}:${statusLabel}:${subscription?.end_date || "no-end-date"}:${loginSignature}`;
      const paymentUrl = planId
        ? buildMonCashSubscriptionPaymentLink({
            businessId,
            subscriptionId: subscription?.id,
            planId,
            billingCycle,
            businessName,
            planName: planName || undefined,
            amount: amount && Number.isFinite(amount) ? amount : null,
            currencyCode: business?.currency_code || "HTG",
          })
        : null;

      const title = !subscription
        ? "Activez votre abonnement"
        : isPastDue
          ? "Paiement en retard"
          : isExpired
            ? "Votre abonnement est expiré"
            : isTrialingSoon
              ? "Votre essai se termine bientôt"
              : "Votre abonnement arrive à expiration";

      const remainingText = formatDaysRemaining(daysRemaining);
      const description = !subscription
        ? "Votre établissement est prêt à finaliser son abonnement."
        : isPastDue
          ? "Un paiement est en attente pour maintenir vos accès actifs."
          : isExpired
            ? "Régularisez votre abonnement pour réactiver toutes les fonctionnalités."
            : `Il reste ${remainingText || "peu de temps"} avant l'échéance.`;

      const ctaLabel = !subscription || isExpired || isPastDue ? "Payer maintenant" : "Renouveler maintenant";

      return {
        shouldPrompt,
        storageKey,
        title,
        description,
        ctaLabel,
        paymentUrl,
        businessName,
        planName,
        statusLabel,
        daysRemaining,
      };
    },
  });

  const fallbackValue = useMemo<SubscriptionPaymentReminder>(
    () => ({
      shouldPrompt: false,
      storageKey: "",
      title: "",
      description: "",
      ctaLabel: "Payer maintenant",
      paymentUrl: null,
      businessName: "Votre établissement",
      planName: null,
      statusLabel: "active",
      daysRemaining: null,
      loading: true,
    }),
    []
  );

  if (!query.data) {
    return { ...fallbackValue, loading: query.isLoading };
  }

  return { ...query.data, loading: query.isLoading };
}
