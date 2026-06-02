import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { MONCASH_PUBLIC_URLS } from "@/lib/moncash";
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  Pencil,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  Layers3,
} from "lucide-react";

type SubscriptionStatus = "active" | "trialing" | "past_due" | "expired" | "cancelled" | string;

interface BusinessRow {
  id: string;
  name: string | null;
  status: string | null;
  plan_id: string | null;
  referred_by_partner_code: string | null;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  business_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: string;
  auto_renew: boolean;
  start_date: string;
  end_date: string | null;
  price_snapshot: number | string | null;
  currency_code: string | null;
  created_at: string;
}

interface BranchRow {
  id: string;
  business_id: string;
  active: boolean;
  created_at: string;
}

interface PlanRow {
  id: string;
  name: string;
  monthly_price: number | string | null;
  active: boolean;
}

interface LoyaltyAccountRow {
  id: string;
  business_id: string;
  active: boolean;
}

interface DebtRow {
  id: string;
  business_id: string;
  outstanding_balance: number | string | null;
  status: string;
}

interface EstablishmentRow {
  id: string;
  name: string;
  statusLabel: string;
  statusValue: SubscriptionStatus;
  planRef: string | null;
  planName: string;
  billingCycle: string;
  autoRenew: boolean;
  createdAt: string;
  endDate: string | null;
  priceSnapshot: number;
  currencyCode: string;
  branchCount: number;
  activeBranchCount: number;
  loyaltyAccountsCount: number;
  openDebtsCount: number;
  openDebtAmount: number;
  partnerCode: string | null;
  isPremium: boolean;
  expiringSoon: boolean;
  subscriptionId: string | null;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Tous les statuts" },
  { value: "active", label: "Actif" },
  { value: "trialing", label: "Essai" },
  { value: "past_due", label: "En retard" },
  { value: "expired", label: "Expiré" },
  { value: "cancelled", label: "Annulé" },
] as const;

const BILLING_OPTIONS = [
  { value: "all", label: "Tous les cycles" },
  { value: "monthly", label: "Mensuel" },
  { value: "yearly", label: "Annuel" },
  { value: "custom", label: "Personnalisé" },
] as const;

const SORT_OPTIONS = [
  { value: "recent", label: "Plus récents" },
  { value: "oldest", label: "Plus anciens" },
  { value: "name", label: "Nom A-Z" },
  { value: "branches", label: "Plus de branches" },
] as const;

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("fr-FR");
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function normalizePlanKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolvePlan(plans: PlanRow[], rawValue: string | null | undefined) {
  if (!rawValue) return null;
  const normalized = normalizePlanKey(rawValue);
  const aliasMap: Record<string, string> = {
    basic: "starter",
    pro: "professional",
    premium: "enterprise",
  };
  const alias = aliasMap[normalized];
  const candidates = new Set([normalized, alias ? normalizePlanKey(alias) : ""]);

  return plans.find((plan) => {
    const idKey = normalizePlanKey(plan.id);
    const nameKey = normalizePlanKey(plan.name);
    return candidates.has(idKey) || candidates.has(nameKey);
  }) ?? null;
}

function statusMeta(status: SubscriptionStatus) {
  switch (status) {
    case "active":
      return { label: "Actif", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
    case "trialing":
      return { label: "Essai", className: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20" };
    case "past_due":
      return { label: "En retard", className: "bg-amber-500/15 text-amber-300 border-amber-500/20" };
    case "expired":
      return { label: "Expiré", className: "bg-rose-500/15 text-rose-300 border-rose-500/20" };
    case "cancelled":
      return { label: "Annulé", className: "bg-slate-500/15 text-slate-300 border-slate-500/20" };
    default:
      return { label: "Sans abonnement", className: "bg-slate-500/15 text-slate-300 border-slate-500/20" };
  }
}

export default function SalonsPage() {
  const { format } = useCurrency();
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loyaltyAccounts, setLoyaltyAccounts] = useState<LoyaltyAccountRow[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [sortFilter, setSortFilter] = useState<string>("recent");
  const [editingRow, setEditingRow] = useState<EstablishmentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlanId, setEditPlanId] = useState("");

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);

    const [
      businessesResult,
      subscriptionsResult,
      branchesResult,
      plansResult,
      loyaltyResult,
      debtsResult,
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select("id, name, status, plan_id, referred_by_partner_code, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_subscriptions")
        .select("id, business_id, plan_id, status, billing_cycle, auto_renew, start_date, end_date, price_snapshot, currency_code, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("business_branches")
        .select("id, business_id, active, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("subscription_plans")
        .select("id, name, monthly_price, active")
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_loyalty_accounts")
        .select("id, business_id, active"),
      supabase
        .from("customer_debts")
        .select("id, business_id, outstanding_balance, status"),
    ]);

    const firstError =
      businessesResult.error ||
      subscriptionsResult.error ||
      branchesResult.error ||
      plansResult.error ||
      loyaltyResult.error ||
      debtsResult.error;

    if (firstError) {
      setErrorMessage(firstError.message);
      toast.error("Impossible de charger les établissements.");
    }

    setBusinesses((businessesResult.data as BusinessRow[] | null) ?? []);
    setSubscriptions((subscriptionsResult.data as SubscriptionRow[] | null) ?? []);
    setBranches((branchesResult.data as BranchRow[] | null) ?? []);
    setPlans((plansResult.data as PlanRow[] | null) ?? []);
    setLoyaltyAccounts((loyaltyResult.data as LoyaltyAccountRow[] | null) ?? []);
    setDebts((debtsResult.data as DebtRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();

    const handleFocus = () => {
      void loadData();
    };

    const timer = window.setInterval(() => {
      void loadData();
    }, 30000);

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const rows = useMemo(() => {
    const latestSubscriptionByBusiness = new Map<string, SubscriptionRow>();
    subscriptions
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((subscription) => {
        if (!latestSubscriptionByBusiness.has(subscription.business_id)) {
          latestSubscriptionByBusiness.set(subscription.business_id, subscription);
        }
      });

    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    const branchStats = branches.reduce(
      (acc, branch) => {
        const current = acc.get(branch.business_id) ?? { total: 0, active: 0 };
        current.total += 1;
        if (branch.active) current.active += 1;
        acc.set(branch.business_id, current);
        return acc;
      },
      new Map<string, { total: number; active: number }>()
    );

    const loyaltyStats = loyaltyAccounts.reduce(
      (acc, account) => {
        const current = acc.get(account.business_id) ?? 0;
        acc.set(account.business_id, current + 1);
        return acc;
      },
      new Map<string, number>()
    );

    const debtStats = debts.reduce(
      (acc, debt) => {
        const current = acc.get(debt.business_id) ?? { count: 0, amount: 0 };
        const balance = toNumber(debt.outstanding_balance);
        if (["open", "partial"].includes(debt.status) && balance > 0) {
          current.count += 1;
          current.amount += balance;
        }
        acc.set(debt.business_id, current);
        return acc;
      },
      new Map<string, { count: number; amount: number }>()
    );

    return businesses.map((business) => {
      const subscription = latestSubscriptionByBusiness.get(business.id);
      const rawPlanRef = subscription?.plan_id ?? business.plan_id ?? null;
      const plan = resolvePlan(plans, rawPlanRef) ?? (subscription ? planById.get(subscription.plan_id) : business.plan_id ? planById.get(business.plan_id) : undefined);
      const branchStat = branchStats.get(business.id) ?? { total: 0, active: 0 };
      const loyaltyCount = loyaltyStats.get(business.id) ?? 0;
      const debtStat = debtStats.get(business.id) ?? { count: 0, amount: 0 };
      const statusValue = subscription?.status ?? business.status ?? "unknown";
      const trialEnd = subscription?.end_date ?? addDays(subscription?.start_date || business.created_at, 7).toISOString();
      const daysLeft = daysUntil(trialEnd);
      const expiringSoon =
        (statusValue === "active" || statusValue === "trialing") &&
        daysLeft !== null &&
        daysLeft >= 0 &&
        daysLeft <= 7;

      return {
        id: business.id,
        name: business.name || "Établissement sans nom",
        statusLabel: statusMeta(statusValue).label,
        statusValue,
        planRef: rawPlanRef,
        planName: plan?.name || rawPlanRef || "Plan non défini",
        billingCycle: subscription?.billing_cycle || "monthly",
        autoRenew: subscription?.auto_renew ?? false,
        createdAt: business.created_at,
        endDate: trialEnd,
        priceSnapshot: toNumber(subscription?.price_snapshot ?? plan?.monthly_price ?? 0),
        currencyCode: subscription?.currency_code || "HTG",
        branchCount: branchStat.total,
        activeBranchCount: branchStat.active,
        loyaltyAccountsCount: loyaltyCount,
        openDebtsCount: debtStat.count,
        openDebtAmount: debtStat.amount,
        partnerCode: business.referred_by_partner_code,
        isPremium: (plan?.name || rawPlanRef || "").toLowerCase().includes("premium") || toNumber(plan?.monthly_price ?? 0) >= 99,
        expiringSoon,
        subscriptionId: subscription?.id ?? null,
      } satisfies EstablishmentRow;
    });
  }, [businesses, branches, debts, loyaltyAccounts, plans, subscriptions]);

  const filteredRows = useMemo(() => {
    const searchTerm = searchQuery.trim().toLowerCase();

    return rows
      .filter((row) => {
        const matchesSearch =
          searchTerm.length === 0 ||
          [row.name, row.planName, row.statusLabel, row.billingCycle, row.partnerCode || "", row.id]
            .join(" ")
            .toLowerCase()
            .includes(searchTerm);
        const matchesStatus = statusFilter === "all" || row.statusValue === statusFilter;
        const matchesBilling = billingFilter === "all" || row.billingCycle === billingFilter;
        const matchesPlan = planFilter === "all" || row.planName === planFilter;
        return matchesSearch && matchesStatus && matchesBilling && matchesPlan;
      })
      .sort((a, b) => {
        if (sortFilter === "name") return a.name.localeCompare(b.name);
        if (sortFilter === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortFilter === "branches") return b.branchCount - a.branchCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [billingFilter, planFilter, rows, searchQuery, sortFilter, statusFilter]);

  const planOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.planName))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const totalBusinesses = rows.length;
  const activeBusinesses = rows.filter((row) => row.statusValue === "active" || row.statusValue === "trialing").length;
  const expiringSoonBusinesses = rows.filter((row) => row.expiringSoon).length;
  const overdueBusinesses = rows.filter((row) => row.statusValue === "past_due").length;
  const activeBranches = branches.filter((branch) => branch.active).length;
  const totalLoyaltyAccounts = loyaltyAccounts.filter((account) => account.active).length;
  const openDebtCount = debts.filter((debt) => ["open", "partial"].includes(debt.status) && toNumber(debt.outstanding_balance) > 0).length;
  const openDebtAmount = debts.reduce((sum, debt) => {
    if (!["open", "partial"].includes(debt.status)) return sum;
    return sum + toNumber(debt.outstanding_balance);
  }, 0);

  const openEditModal = (row: EstablishmentRow) => {
    setEditingRow(row);
    setEditName(row.name);
    const matchedPlan = resolvePlan(plans, row.planRef) ?? plans.find((plan) => plan.name === row.planName);
    setEditPlanId(matchedPlan?.id || "");
  };

  const saveEdit = async () => {
    if (!editingRow) return;

    const { error: businessError } = await supabase
      .from("businesses")
      .update({
        name: editName.trim(),
        plan_id: editPlanId || null,
      })
      .eq("id", editingRow.id);

    if (businessError) {
      toast.error(businessError.message);
      return;
    }

    if (editingRow.subscriptionId) {
      const selectedPlan = plans.find((plan) => plan.id === editPlanId);
      const { error: subscriptionError } = await supabase
        .from("business_subscriptions")
        .update({
          plan_id: editPlanId || null,
          price_snapshot: toNumber(selectedPlan?.monthly_price ?? editingRow.priceSnapshot),
        })
        .eq("id", editingRow.subscriptionId);

      if (subscriptionError) {
        toast.error(subscriptionError.message);
        return;
      }
    }

    toast.success("Établissement modifié avec succès.");
    setEditingRow(null);
    await loadData();
  };

  const toggleSuspension = async (row: EstablishmentRow) => {
    const shouldSuspend = row.statusValue === "active" || row.statusValue === "trialing";
    const nextBusinessStatus = shouldSuspend ? "inactive" : "active";
    const nextSubscriptionStatus = shouldSuspend ? "cancelled" : "active";

    const { error: businessError } = await supabase
      .from("businesses")
      .update({ status: nextBusinessStatus })
      .eq("id", row.id);

    if (businessError) {
      toast.error(businessError.message);
      return;
    }

    if (row.subscriptionId) {
      const { error: subscriptionError } = await supabase
        .from("business_subscriptions")
        .update({ status: nextSubscriptionStatus })
        .eq("id", row.subscriptionId);

      if (subscriptionError) {
        toast.error(subscriptionError.message);
        return;
      }
    }

    toast.success(shouldSuspend ? "Établissement suspendu." : "Établissement réactivé.");
    await loadData();
  };

  const deleteEstablishment = async (row: EstablishmentRow) => {
    const confirmed = window.confirm(`Supprimer définitivement ${row.name} ? Cette action est irréversible.`);
    if (!confirmed) return;

    const { error } = await supabase.from("businesses").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Établissement supprimé.");
    await loadData();
  };

  const buildMonCashPaymentLink = (row: EstablishmentRow) => {
    const url = new URL(MONCASH_PUBLIC_URLS.subscriptionPaymentUrl);
    url.searchParams.set("business_id", row.id);
    if (row.subscriptionId) url.searchParams.set("subscription_id", row.subscriptionId);
    if (row.planRef) url.searchParams.set("plan_id", row.planRef);
    url.searchParams.set("billing_cycle", row.billingCycle || "monthly");
    url.searchParams.set("business_name", row.name);
    url.searchParams.set("plan_name", row.planName);
    url.searchParams.set("amount", String(row.priceSnapshot || 0));
    url.searchParams.set("currency_code", row.currencyCode || "HTG");
    return url.toString();
  };

  const copyMonCashPaymentLink = async (row: EstablishmentRow) => {
    try {
      await navigator.clipboard.writeText(buildMonCashPaymentLink(row));
      toast.success("Lien MonCash copié.");
    } catch {
      toast.error("Impossible de copier le lien MonCash.");
    }
  };

  return (
    <DashboardLayout
      role="super_admin"
      title="Établissements"
      subtitle="Supervisez tous les business connectés à Wesd Systems, avec leurs abonnements, branches et services associés."
      userName="Admin Wesd"
    >
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total établissements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{loading ? "..." : totalBusinesses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Actifs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-success">{loading ? "..." : activeBusinesses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Expirent bientôt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-warning">{loading ? "..." : expiringSoonBusinesses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Branches actives</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-cyan-300">{loading ? "..." : activeBranches}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Créances ouvertes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{loading ? "..." : openDebtCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {loading ? "Chargement..." : format(openDebtAmount)}
                </p>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-1">
                <div className="relative w-full md:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    placeholder="Rechercher un établissement, un plan ou un code parrain..."
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={billingFilter} onValueChange={setBillingFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les plans</SelectItem>
                    {planOptions.map((planName) => (
                      <SelectItem key={planName} value={planName}>
                        {planName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortFilter} onValueChange={setSortFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Tri" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={() => void loadData()} className="w-full lg:w-auto">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Actualiser
              </Button>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredRows.map((row) => {
              const meta = statusMeta(row.statusValue);
              return (
                <div
                  key={row.id}
                  className="group rounded-2xl border border-border bg-card/85 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg font-bold text-white shadow-lg shadow-violet-500/20">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">{row.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>Créé le {formatDate(row.createdAt)}</span>
                          {row.partnerCode && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                              Parrain {row.partnerCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan</div>
                      <div className="mt-1 font-medium">{row.planName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.priceSnapshot > 0 ? format(row.priceSnapshot) : "Tarif non défini"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Abonnement</div>
                      <div className="mt-1 font-medium capitalize">{row.billingCycle}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.autoRenew ? "Renouvellement automatique" : "Renouvellement désactivé"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Branches</div>
                      <div className="mt-1 font-medium">
                        {row.activeBranchCount}/{row.branchCount} actives
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Structure opérationnelle</div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Fidélité & crédit</div>
                      <div className="mt-1 font-medium">
                        {row.loyaltyAccountsCount} comptes, {row.openDebtsCount} dettes
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Encours: {format(row.openDebtAmount)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {row.isPremium ? "Profil premium" : "Profil standard"}
                    </span>
                    {row.endDate && (row.statusValue === "active" || row.statusValue === "trialing") && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">
                        <Clock3 className="h-3.5 w-3.5" />
                        Fin d'essai {formatDate(row.endDate)}
                      </span>
                    )}
                    {row.expiringSoon && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-300">
                        <Clock3 className="h-3.5 w-3.5" />
                        Expire bientôt
                      </span>
                    )}
                    {row.statusValue === "past_due" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-rose-300">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Paiement en retard
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border/70 pt-4">
                    <Button variant="outline" size="sm" onClick={() => openEditModal(row)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Modifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(buildMonCashPaymentLink(row), "_blank")}>
                      <Wallet className="mr-2 h-4 w-4" />
                      MonCash
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void copyMonCashPaymentLink(row)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copier le lien
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void toggleSuspension(row)}>
                      {row.statusValue === "active" || row.statusValue === "trialing" ? (
                        <>
                          <Ban className="mr-2 h-4 w-4" />
                          Suspendre
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Réactiver
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void deleteEstablishment(row)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </StaggerItem>

        {!loading && filteredRows.length === 0 && (
          <StaggerItem>
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
              <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">Aucun établissement ne correspond à vos filtres.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Essayez de retirer un filtre ou de modifier la recherche.
              </p>
            </div>
          </StaggerItem>
        )}

        {loading && (
          <StaggerItem>
            <div className="rounded-2xl border border-border bg-card/60 p-12 text-center text-sm text-muted-foreground">
              Chargement des établissements depuis Supabase...
            </div>
          </StaggerItem>
        )}

        <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Modifier l'établissement</DialogTitle>
              <DialogDescription>
                Mettez à jour le nom public et le plan associé à cet établissement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-establishment-name">Nom</Label>
                <Input id="edit-establishment-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={editPlanId} onValueChange={setEditPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingRow(null)}>
                Annuler
              </Button>
              <Button type="button" onClick={() => void saveEdit()}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <StaggerItem>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Abonnements actifs</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div>
                  <div className="text-xl font-bold">
                    {rows.filter((row) => row.statusValue === "active" || row.statusValue === "trialing").length}
                  </div>
                  <div className="text-xs text-muted-foreground">Actifs ou en essai</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Plans disponibles</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Layers3 className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="text-xl font-bold">{plans.length}</div>
                  <div className="text-xs text-muted-foreground">Offres disponibles</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Comptes fidélité</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-violet-300" />
                <div>
                  <div className="text-xl font-bold">{totalLoyaltyAccounts}</div>
                  <div className="text-xs text-muted-foreground">Comptes actifs</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
