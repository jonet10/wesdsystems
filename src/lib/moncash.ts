const PUBLIC_DOMAIN = import.meta.env.VITE_PUBLIC_DOMAIN || "wesdsystems.store";

const normalizeUrl = (path: string) => `https://${PUBLIC_DOMAIN}${path.startsWith("/") ? path : `/${path}`}`;

export const MONCASH_PUBLIC_URLS = {
  websiteUrl: `https://${PUBLIC_DOMAIN}`,
  returnUrl: normalizeUrl("/api/moncash/return"),
  alertUrl: normalizeUrl("/moncash/confirmation"),
  subscriptionPaymentUrl: normalizeUrl("/billing/moncash"),
} as const;

export type MonCashSubscriptionPaymentLinkInput = {
  businessId: string;
  subscriptionId?: string | null;
  planId: string;
  billingCycle?: string | null;
  durationMonths?: number | null;
  businessName?: string | null;
  planName?: string | null;
  amount?: number | null;
  currencyCode?: string | null;
};

export function buildMonCashSubscriptionPaymentLink(input: MonCashSubscriptionPaymentLinkInput) {
  const params = new URLSearchParams();
  params.set("business_id", input.businessId);
  params.set("plan_id", input.planId);
  if (input.subscriptionId) params.set("subscription_id", input.subscriptionId);
  if (input.billingCycle) params.set("billing_cycle", input.billingCycle);
  if (typeof input.durationMonths === "number" && Number.isFinite(input.durationMonths)) {
    params.set("duration_months", String(input.durationMonths));
  }
  if (input.businessName) params.set("business_name", input.businessName);
  if (input.planName) params.set("plan_name", input.planName);
  if (typeof input.amount === "number" && Number.isFinite(input.amount)) params.set("amount", String(input.amount));
  if (input.currencyCode) params.set("currency_code", input.currencyCode);

  const query = params.toString();
  return query ? `${MONCASH_PUBLIC_URLS.subscriptionPaymentUrl}?${query}` : MONCASH_PUBLIC_URLS.subscriptionPaymentUrl;
}

export const MONCASH_API_ENDPOINTS = {
  websiteUrlKey: "website_url",
  returnUrlKey: "return_url",
  alertUrlKey: "alert_url",
} as const;
