export type SubscriptionStatus = "active" | "trialing" | "past_due" | "expired" | "cancelled";

export type PlanFeatureKey =
  | "standard_pos"
  | "basic_reports"
  | "advanced_analytics"
  | "loyalty_program"
  | "customer_credit"
  | "advanced_reports"
  | "all_features"
  | "multi_location_analytics"
  | "api_access"
  | "priority_support";

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  max_businesses: number | null;
  max_branches: number | null;
  max_staff: number | null;
  active: boolean;
  description?: string | null;
}

export interface SubscriptionFeature {
  id: string;
  plan_id: string;
  feature_key: PlanFeatureKey | string;
  enabled: boolean;
  feature_label?: string | null;
  feature_group?: string | null;
  sort_order?: number;
}

export interface BusinessSubscription {
  id: string;
  business_id: string;
  plan_id: string;
  start_date: string;
  end_date: string | null;
  status: SubscriptionStatus;
  billing_cycle?: "monthly" | "yearly" | "custom";
  auto_renew?: boolean;
  price_snapshot?: number;
  currency_code?: string;
  notes?: string | null;
}

export interface BusinessBranch {
  id: string;
  business_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  manager_id?: string | null;
  active?: boolean;
  branch_code?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const UNLIMITED_LIMIT = null;

export const featureLabels: Record<string, string> = {
  standard_pos: "Standard POS",
  basic_reports: "Rapports basiques",
  advanced_analytics: "Analytics avancés",
  loyalty_program: "Programme fidélité",
  customer_credit: "Crédit client",
  advanced_reports: "Rapports avancés",
  all_features: "Toutes les fonctionnalités",
  multi_location_analytics: "Analytics multi-sites",
  api_access: "Accès API",
  priority_support: "Support prioritaire",
};

export function isUnlimited(limit: number | null | undefined): boolean {
  return limit === null || limit === undefined || Number.isNaN(Number(limit));
}

export function formatLimit(limit: number | null | undefined): string {
  return isUnlimited(limit) ? "Illimité" : String(limit);
}

export function planFeatureEnabled(features: SubscriptionFeature[] | undefined, key: PlanFeatureKey): boolean {
  return !!features?.some((feature) => feature.feature_key === key && feature.enabled);
}

export function resolveActiveBranchId(businessId: string | null | undefined, fallbackBranchId: string | null | undefined) {
  return fallbackBranchId || businessId || null;
}

export function normalizePlanName(name: string | null | undefined) {
  return (name || "").trim().toLowerCase();
}

export function getDefaultPlanLimits(planName: string) {
  const normalized = normalizePlanName(planName);

  if (normalized === "starter") {
    return { maxBranches: 1, maxStaff: 10 };
  }

  if (normalized === "professional") {
    return { maxBranches: 3, maxStaff: 15 };
  }

  return { maxBranches: null, maxStaff: null };
}

