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
  business_type?: string | null;
};

async function sendExpiryWhatsAppAlert(
  businessId: string,
  businessName: string,
  planName: string,
  paymentUrl: string | null,
  recipientPhone: string
) {
  try {
    const { data: globalConfigData } = await supabase.rpc("get_app_config");
    const globalConfig = globalConfigData || {};

    const isGlobalEnabled = globalConfig.whatsapp_global_enabled !== "false";
    if (!isGlobalEnabled) return;

    const providerName = globalConfig.whatsapp_global_provider || "openwa";
    let apiUrl = globalConfig.whatsapp_global_api_url || "";
    if (!apiUrl || apiUrl === "default") {
      apiUrl = "http://localhost:3000";
    }
    const apiKey = globalConfig.whatsapp_global_api_key || "";
    const sessionName = globalConfig.whatsapp_global_session_name || "default";

    const { OpenWaProvider, UltraMsgProvider, MetaCloudProvider, TwilioProvider } = await import("@/modules/pharmacy/services/whatsappService");
    
    let provider;
    if (providerName === "ultramsg") provider = new UltraMsgProvider();
    else if (providerName === "meta") provider = new MetaCloudProvider();
    else if (providerName === "twilio") provider = new TwilioProvider();
    else provider = new OpenWaProvider();

    const linkText = paymentUrl ? `\n\nRenouvelez dès maintenant ici : ${paymentUrl}` : "";
    const message = `[Wesd Systems] Alerte Abonnement : Bonjour, l'abonnement pour votre établissement "${businessName}" a expiré (Forfait : ${planName || "Standard"}). Veuillez régulariser votre compte pour réactiver toutes les fonctionnalités.${linkText}`;

    console.log(`[Subscription Alert] Sending WhatsApp to: ${recipientPhone}`);
    await provider.sendMessage(apiUrl, apiKey, recipientPhone.replace(/\D/g, ""), message, sessionName);
  } catch (err) {
    console.error("Failed to send subscription WhatsApp alert:", err);
  }
}

type PlanRow = {
  id: string;
  name: string;
  monthly_price: number | string | null;
  yearly_price: number | string | null;
  active: boolean;
};

export type SubscriptionPaymentReminder = {
  shouldPrompt: boolean;
  severity: "none" | "warning" | "critical";
  isCritical: boolean;
  dismissible: boolean;
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

export function computeDaysRemaining(endDate: string | null): number | null {
  if (!endDate) return null;
  const [y, m, d] = endDate.split('-').map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days;
}

export function useSubscriptionPaymentReminder(): SubscriptionPaymentReminder {
  const { profile, isAuthenticated } = useAuth();
  const businessId = profile?.business_id ?? null;
  const isBusinessOwner = Boolean(
    profile?.role?.includes("admin") ||
    profile?.role_normalized?.includes("admin") ||
    profile?.role === "owner" ||
    profile?.role === "manager" ||
    profile?.role === "salon_admin" ||
    profile?.role === "bar_admin"
  );

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
          .select("id, name, plan_id, currency_code, business_type")
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

      const daysRemaining = computeDaysRemaining(subscription?.end_date || null);
      const businessName = business?.name?.trim() || "Votre établissement";
      const planName = plan?.name ?? null;
      const billingCycle = subscription?.billing_cycle || "monthly";
      const amount = plan
        ? Number(billingCycle === "yearly" ? plan.yearly_price || 0 : plan.monthly_price || 0)
        : null;

      // --- Compute severity ---
      // Rule: missing subscription + plan exists = WARNING (never block access)
      // Rule: trialing with future end_date = no prompt (or warning if <= 7 days)
      // Rule: expired = CRITICAL (block access)
      // Rule: active/cancelled/past_due daysRemaining < 0 = CRITICAL

      let isExpired = false;
      let isPastDue = false;
      let isTrialingSoon = false;
      let isExpiringSoon = false;
      let severity: SubscriptionPaymentReminder["severity"] = "none";

      if (!subscription) {
        // No subscription row at all: if plan exists, show a warning prompt
        // (never critical — the business might just have a plan_id but no trial yet)
        if (planId) {
          severity = "warning";
        } else {
          severity = "none";
        }
      } else if (subscription.status === "past_due") {
        isPastDue = true;
        severity = "critical";
      } else if (subscription.status === "expired" || subscription.status === "cancelled") {
        isExpired = true;
        severity = "critical";
      } else if (daysRemaining !== null && daysRemaining < 0) {
        // Status says active/trialing but end_date has passed
        isExpired = true;
        severity = "critical";
      } else if (subscription.status === "trialing" && daysRemaining !== null && daysRemaining <= 7) {
        isTrialingSoon = true;
        severity = "warning";
      } else if (subscription.status === "active" && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7) {
        isExpiringSoon = true;
        severity = "warning";
      }

      const shouldPrompt = Boolean(planId && severity !== "none");
      const isCritical = severity === "critical";
      const dismissible = !isCritical;

      const statusLabel = !subscription
        ? "no_subscription"
        : isPastDue
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

      // Try to find the contact phone number of the business
      let ownerPhone = "";
      try {
        if (business?.business_type === "school") {
          const { data: schoolSet } = await supabase
            .from("school_settings")
            .select("whatsapp, phone")
            .eq("business_id", businessId)
            .maybeSingle();
          ownerPhone = schoolSet?.whatsapp || schoolSet?.phone || "";
        } else if (business?.business_type === "pharmacy") {
          const { data: pharmSet } = await supabase
            .from("pharmacy_whatsapp_settings")
            .select("owner_phone")
            .eq("business_id", businessId)
            .maybeSingle();
          ownerPhone = pharmSet?.owner_phone || "";
        } else if (business?.business_type === "salon") {
          const { data: salonSet } = await supabase
            .from("salon_business_profiles")
            .select("phone")
            .eq("business_id", businessId)
            .maybeSingle();
          ownerPhone = salonSet?.phone || "";
        }
        
        if (!ownerPhone) {
          const { data: userData } = await supabase.auth.getUser();
          ownerPhone = userData?.user?.phone || userData?.user?.user_metadata?.phone || "";
        }
      } catch (phoneErr) {
        console.error("Error retrieving owner contact details:", phoneErr);
      }

      if (isExpired && ownerPhone && planName) {
        const alertSentKey = `subscription-whatsapp-alert-sent:${businessId}:${subscription?.id || "no-sub"}`;
        const hasBeenSent = localStorage.getItem(alertSentKey);
        if (!hasBeenSent) {
          localStorage.setItem(alertSentKey, "true");
          // Trigger the WhatsApp message asynchronously
          void sendExpiryWhatsAppAlert(businessId, businessName, planName, paymentUrl, ownerPhone);
        }
      }

      // Titles and descriptions for each scenario
      let title: string;
      let description: string;
      let ctaLabel: string;

      if (!subscription) {
        title = planId ? "Activez votre abonnement" : "Aucun forfait défini";
        description = planId
          ? "Votre établissement est prêt à finaliser son abonnement."
          : "Contactez l'administrateur pour configurer un forfait.";
        ctaLabel = planId ? "Payer maintenant" : "Contacter l'assistance";
      } else if (isPastDue) {
        title = "Paiement en retard";
        description = "Un paiement est en attente pour maintenir vos accès actifs.";
        ctaLabel = "Payer maintenant";
      } else if (isExpired) {
        title = "Votre abonnement est expiré";
        description = "Régularisez votre abonnement pour réactiver toutes les fonctionnalités.";
        ctaLabel = "Payer maintenant";
      } else if (isTrialingSoon) {
        title = "Votre essai se termine bientôt";
        description = `Il reste ${formatDaysRemaining(daysRemaining) || "peu de temps"} avant l'échéance.`;
        ctaLabel = "Renouveler maintenant";
      } else if (isExpiringSoon) {
        title = "Votre abonnement arrive à expiration";
        description = `Il reste ${formatDaysRemaining(daysRemaining) || "peu de temps"} avant l'échéance.`;
        ctaLabel = "Renouveler maintenant";
      } else {
        title = "";
        description = "";
        ctaLabel = "Payer maintenant";
      }

      return {
        shouldPrompt,
        severity,
        isCritical,
        dismissible,
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
      severity: "none",
      isCritical: false,
      dismissible: true,
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
