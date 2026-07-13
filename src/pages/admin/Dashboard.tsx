import { useTranslation } from "react-i18next";
import { useState, useEffect, type ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Building2, CreditCard, Users, TrendingUp, AlertTriangle, CheckCircle, Handshake, GitBranch, Gift, BadgeDollarSign, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { SubscriptionPayment } from "@/lib/payment-providers";
import { formatPaymentStatus, getPaymentProvider } from "@/lib/payment-providers";

type DashboardStat = {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: { value: number; isPositive: boolean };
};

type SubscriptionRow = {
  business_id: string;
  plan_id: string;
  status: "active" | "trialing" | "past_due" | "expired" | "cancelled";
  price_snapshot: number | null;
  created_at: string;
  end_date: string | null;
  billing_cycle: "monthly" | "yearly" | "custom" | null;
};

type BusinessRow = {
  id: string;
  name: string;
  status: string | null;
  created_at: string;
  plan_id: string | null;
  planName: string;
};

type PlatformModule = {
  name: string;
  phase: "complete" | "building" | "coming_soon";
  description: string;
  label: string;
};

function normalizePlanKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolvePlanName(plans: Array<{ id: string; name: string }>, rawValue: string | null | undefined) {
  if (!rawValue) return null;
  const normalized = normalizePlanKey(rawValue);
  const aliasMap: Record<string, string> = {
    basic: "starter",
    pro: "professional",
    premium: "enterprise",
  };
  const alias = aliasMap[normalized];
  const candidates = new Set([normalized, alias ? normalizePlanKey(alias) : ""]);
  const plan = plans.find((entry) => candidates.has(normalizePlanKey(entry.id)) || candidates.has(normalizePlanKey(entry.name)));
  return plan?.name ?? null;
}

const platformModules: PlatformModule[] = [
  {
    name: "Salon",
    phase: "complete",
    label: "Complet",
    description: "Rendez-vous, POS, services, stock et équipe déjà en production.",
  },
  {
    name: "Pharmacie",
    phase: "building",
    label: "En construction",
    description: "Ordonnances, stock médicaments et caisse sont en intégration.",
  },
  {
    name: "Bar & resto",
    phase: "complete",
    label: "Complet",
    description: "POS, cuisine, bar, commandes et reporting sont opérationnels.",
  },
  {
    name: "Market",
    phase: "building",
    label: "En construction",
    description: "Inventaire, caisse et flux de vente sont en cours d'industrialisation.",
  },
  {
    name: "Boutique",
    phase: "building",
    label: "En construction",
    description: "Stocks, produits et caisse sont préparés pour le prochain déploiement.",
  },
  {
    name: "Pièces Auto",
    phase: "complete",
    label: "Complet",
    description: "Catalogue, stock, caisse, fournisseurs et compatibilité véhicules.",
  },
  {
    name: "Paiements Scolaires",
    phase: "complete",
    label: "Complet",
    description: "Gestion des élèves, professeurs, frais scolaires, paiements et rapports financiers.",
  },
];

export default function SuperAdminDashboard() {
  const { t } = useTranslation();
  const { formatCompact } = useCurrency();
  const [stats, setStats] = useState<DashboardStat[]>([
    { title: "Établissements actifs", value: "0", icon: <Building2 className="h-6 w-6" />, trend: { value: 12, isPositive: true } },
    { title: "Revenus mensuels", value: "0", icon: <CreditCard className="h-6 w-6" />, trend: { value: 8, isPositive: true } },
    { title: "Utilisateurs totaux", value: "0", icon: <Users className="h-6 w-6" />, trend: { value: 15, isPositive: true } },
    { title: "Branches actives", value: "0", icon: <GitBranch className="h-6 w-6" />, trend: { value: 6, isPositive: true } },
    { title: "Plans actifs", value: "0", icon: <TrendingUp className="h-6 w-6" /> },
    { title: "Encours clients", value: "0", icon: <BadgeDollarSign className="h-6 w-6" /> },
  ]);

  const [recentBusinesses, setRecentBusinesses] = useState<BusinessRow[]>([]);
  const [platformCounts, setPlatformCounts] = useState({
    loyaltyAccounts: 0,
    loyaltyRewards: 0,
    openDebts: 0,
  });
  const [subscriptionStats, setSubscriptionStats] = useState({
    active: 0,
    expiringSoon: 0,
    expired: 0,
    trialing: 0,
    pastDue: 0,
  });
  const [partnerStats, setPartnerStats] = useState({ pending: 0, approved: 0, rejected: 0, suspended: 0 });
  const [missingPlansCount, setMissingPlansCount] = useState(0);
  const [repairingPlans, setRepairingPlans] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<SubscriptionPayment[]>([]);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  const loadData = async () => {
    // Counts
    const [
      { data: businesses },
      { data: allBusinesses },
      { count: totalBusinessesCount },
      { data: subscriptions },
      { data: branches },
      { data: plans },
      { data: partnerRows },
      { count: totalUsersCount },
      { count: loyaltyAccountsCount },
      { data: rewards },
      { data: debts },
      { data: pendingPaymentsData },
    ] = await Promise.all([
      supabase.from("businesses").select("id, name, status, created_at, plan_id").order("created_at", { ascending: false }).limit(25),
      supabase.from("businesses").select("id, plan_id"),
      supabase.from("businesses").select("id", { count: "exact", head: true }),
      supabase.from("business_subscriptions").select("business_id, plan_id, status, price_snapshot, created_at, end_date, billing_cycle").order("created_at", { ascending: false }),
      supabase.from("business_branches").select("id, business_id, active").order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("id, name, monthly_price, active"),
      supabase.from("partners").select("status"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("customer_loyalty_accounts").select("id", { count: "exact", head: true }),
      supabase.from("loyalty_rewards").select("active"),
      supabase.from("customer_debts").select("status, outstanding_balance"),
      supabase.from("subscription_payments").select("*, businesses!inner(name)").in("status", ["pending_verification"]).order("created_at", { ascending: false }),
    ]);

    setPendingPayments((pendingPaymentsData || []) as any[]);

    const planById = new Map((plans || []).map((plan: any) => [plan.id, plan]));
    const subscriptionRows = (subscriptions || []) as SubscriptionRow[];
    const activeSubscriptions = subscriptionRows.filter((subscription) => subscription.status === "active");
    const now = new Date();
    const expiringSoon = subscriptionRows.filter((subscription) => {
      if (!subscription.end_date) return false;
      const endDate = new Date(`${subscription.end_date}T23:59:59`);
      const diffDays = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7 && (subscription.status === "active" || subscription.status === "trialing");
    }).length;
    const expiredSubscriptions = subscriptionRows.filter((subscription) => subscription.status === "expired").length;
    const trialingSubscriptions = subscriptionRows.filter((subscription) => subscription.status === "trialing").length;
    const pastDueSubscriptions = subscriptionRows.filter((subscription) => subscription.status === "past_due").length;

    const activeSubscriptionByBusiness = new Map(
      activeSubscriptions.map((subscription) => [subscription.business_id, subscription])
    );
    const allBusinessesRows = (allBusinesses || []) as Array<{ id: string; plan_id: string | null }>;
    setMissingPlansCount(
      allBusinessesRows.filter((business) => {
        const hasActiveSub = activeSubscriptionByBusiness.has(business.id);
        const currentPlanId = activeSubscriptionByBusiness.get(business.id)?.plan_id || business.plan_id;
        return !currentPlanId || !hasActiveSub;
      }).length
    );

    setRecentBusinesses(
      ((businesses || []) as BusinessRow[]).slice(0, 5).map((business) => ({
        id: business.id,
        name: business.name || "Établissement sans nom",
        status: business.status,
        created_at: business.created_at,
        plan_id: activeSubscriptionByBusiness.get(business.id)?.plan_id || business.plan_id,
        planName:
          resolvePlanName((plans || []) as Array<{ id: string; name: string }>, activeSubscriptionByBusiness.get(business.id)?.plan_id || business.plan_id) ||
          planById.get(activeSubscriptionByBusiness.get(business.id)?.plan_id || business.plan_id)?.name ||
          "Sans plan",
      }))
    );

    const mrrTotal = activeSubscriptions.reduce((sum: number, subscription: any) => {
      const plan = planById.get(subscription.plan_id);
      const price = subscription.price_snapshot ?? plan?.monthly_price ?? 0;
      return sum + Number(price || 0);
    }, 0);
     const displaySalonsActifs = subscriptionRows.filter((subscription) => subscription.status === "active" || subscription.status === "trialing").length;
    const displayUsers = Number(totalUsersCount || 0);
    const activeBranches = (branches || []).filter((branch: any) => branch.active !== false).length;
    const loyaltyRewards = (rewards || []).filter((reward: any) => reward.active !== false).length;
    const debtsData = (debts || []) as Array<{ status: string; outstanding_balance: number | string | null }>;
    const openDebts = debtsData.filter((debt) => debt.status !== "settled").length;
    const outstandingDebt = debtsData.reduce((sum, debt) => sum + Number(debt.outstanding_balance || 0), 0);
    const partnerData = (partnerRows || []) as Array<{ status: string | null }>;
    setPartnerStats({
      pending: partnerData.filter((row) => row.status === "pending").length,
      approved: partnerData.filter((row) => row.status === "approved" || row.status === "active").length,
      rejected: partnerData.filter((row) => row.status === "rejected").length,
      suspended: partnerData.filter((row) => row.status === "suspended").length,
    });
    setSubscriptionStats({
      active: activeSubscriptions.length,
      expiringSoon,
      expired: expiredSubscriptions,
      trialing: trialingSubscriptions,
      pastDue: pastDueSubscriptions,
    });
    setPlatformCounts({
      loyaltyAccounts: Number(loyaltyAccountsCount || 0),
      loyaltyRewards,
      openDebts,
    });

    setStats([
      { title: "Établissements actifs", value: displaySalonsActifs.toLocaleString(), icon: <Building2 className="h-6 w-6" />, trend: { value: 12, isPositive: true } },
      { title: "Revenus mensuels", value: formatCompact(mrrTotal), icon: <CreditCard className="h-6 w-6" />, trend: { value: 8, isPositive: true } },
      { title: "Utilisateurs totaux", value: displayUsers.toLocaleString(), icon: <Users className="h-6 w-6" />, trend: { value: 15, isPositive: true } },
      { title: "Entreprises totales", value: Number(totalBusinessesCount || 0).toLocaleString(), icon: <Building2 className="h-6 w-6" /> },
      { title: "Branches actives", value: activeBranches.toLocaleString(), icon: <GitBranch className="h-6 w-6" /> },
      { title: "Plans actifs", value: (plans || []).filter((plan: any) => plan.active !== false).length.toLocaleString(), icon: <TrendingUp className="h-6 w-6" /> },
      { title: "Encours clients", value: formatCompact(outstandingDebt), icon: <BadgeDollarSign className="h-6 w-6" /> },
    ]);
  };

  const repairMissingPlans = async () => {
    setRepairingPlans(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch("/api/admin/fix-missing-plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Impossible de corriger les plans");
      }

      toast.success(payload?.message || "Plans corrigés avec succès");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors de la correction des plans");
    } finally {
      setRepairingPlans(false);
    }
  };

  const handleApprovePayment = async (payment: any) => {
    setProcessingPayment(payment.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const adminId = sessionData.session?.user?.id;
      if (!adminId) throw new Error("Non authentifié");

      await supabase.from("subscription_payments").update({
        status: "approved",
        admin_id: adminId,
        approved_at: new Date().toISOString(),
      }).eq("id", payment.id);

      const { data: rpcResult, error: rpcError } = await supabase.rpc("extend_or_create_subscription", {
        p_business_id: payment.business_id,
        p_plan_id: payment.plan_id,
        p_duration_months: 1,
        p_amount: Number(payment.amount || 0),
        p_currency_code: payment.currency_code || "HTG",
      });
      if (rpcError) throw rpcError;
      if (!rpcResult?.success) throw new Error(rpcResult?.error || "Échec d'activation");

      toast.success("Paiement approuvé. Abonnement activé.");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors de l'approbation.");
    } finally {
      setProcessingPayment(null);
    }
  };

  const handleRejectPayment = async (payment: any) => {
    setProcessingPayment(payment.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const adminId = sessionData.session?.user?.id;
      if (!adminId) throw new Error("Non authentifié");

      await supabase.from("subscription_payments").update({
        status: "rejected",
        admin_id: adminId,
      }).eq("id", payment.id);

      toast.success("Paiement rejeté.");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors du rejet.");
    } finally {
      setProcessingPayment(null);
    }
  };

  useEffect(() => {
    void loadData();
    const handleUpdate = () => {
      void loadData();
    };
    const interval = window.setInterval(() => {
      void loadData();
    }, 30000);
    const handleFocus = () => {
      void loadData();
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("glowup-store-update", handleUpdate);
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(interval);
    };
  }, [formatCompact]);

  return (
    <DashboardLayout
      role="super_admin"
      title="Dashboard Super Admin"
      subtitle="Vue d'ensemble de la plateforme"
      userName="Admin GlowUp"
    >
      <StaggerContainer className="space-y-8">
        {/* Stats Grid */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Modules complétés</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-display">{platformModules.filter((module) => module.phase === "complete").length}</p>
                <p className="text-xs text-muted-foreground mt-1">Modules déjà en production</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Modules en construction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-display">{platformModules.filter((module) => module.phase === "building").length}</p>
                <p className="text-xs text-muted-foreground mt-1">Fonctions en cours d'intégration</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Modules disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-display">{platformModules.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Salon, Pharmacie, Bar & resto, Market, Boutique, Pièces Auto, Paiements Scolaires</p>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {platformModules.map((module) => (
              <Card key={module.name} className="border-border/70 bg-card/80">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-sm">{module.name}</CardTitle>
                    <Badge variant={module.phase === "complete" ? "default" : module.phase === "coming_soon" ? "outline" : "secondary"}>{module.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-5">{module.description}</p>
                  {module.phase === "coming_soon" && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] text-amber-400/80 font-medium">🚧 Module en cours de développement</p>
                      <p className="text-[11px] text-muted-foreground">✅ Gestion des élèves · Professeurs · Frais scolaires · Écolage · Réinscription · Uniformes · Transport · Cantine · Reçus · Historique · Rapports</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </StaggerItem>

        <StaggerItem>
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm text-muted-foreground">Demandes Partenaires</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Vue rapide sur les candidatures à valider</p>
              </div>
              {partnerStats.pending > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  🔔 Nouvelle demande partenaire
                </Badge>
              ) : (
                <Badge variant="outline">Aucune alerte</Badge>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-2xl font-bold">{partnerStats.pending}</p>
                <p className="text-xs text-muted-foreground">Total en attente</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{partnerStats.approved}</p>
                <p className="text-xs text-muted-foreground">Total approuvées</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{partnerStats.rejected}</p>
                <p className="text-xs text-muted-foreground">Total refusées</p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold">{partnerStats.suspended}</p>
                  <p className="text-xs text-muted-foreground">Total suspendues</p>
                </div>
                <Link to="/admin/partners/applications">
                  <Button variant="outline" size="sm">
                    <Handshake className="mr-2 h-4 w-4" />
                    Voir la file
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Pending Subscription Payments */}
        {pendingPayments.length > 0 && (
          <StaggerItem>
            <Card className="border-warning/20 bg-warning/5">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-sm text-muted-foreground">Paiements d'abonnement</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Transactions en attente de vérification</p>
                </div>
                <Badge variant="destructive" className="gap-1">
                  {pendingPayments.length} en attente
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Salon</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t("common.amount")}</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Méthode</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Code</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t("common.phone")}</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t("common.date")}</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingPayments.map((payment: any) => (
                        <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-sm font-medium">{payment.businesses?.name || "Inconnu"}</td>
                          <td className="p-3 text-sm">{Number(payment.amount).toLocaleString()} {payment.currency_code}</td>
                          <td className="p-3 text-sm">{getPaymentProvider(payment.payment_method)?.label || payment.payment_method}</td>
                          <td className="p-3 text-sm text-muted-foreground">{payment.transaction_reference}</td>
                          <td className="p-3 text-sm text-muted-foreground">{payment.phone_number || "-"}</td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(payment.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8"
                                disabled={processingPayment === payment.id}
                                onClick={() => handleApprovePayment(payment)}
                              >
                                Approuver
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8"
                                disabled={processingPayment === payment.id}
                                onClick={() => handleRejectPayment(payment)}
                              >
                                Rejeter
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        )}

        {/* Recent Salons */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold font-display">Établissements récents</h2>
                <p className="text-sm text-muted-foreground">Dernières inscriptions et activités</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={missingPlansCount > 0 ? "destructive" : "outline"} className="hidden sm:inline-flex">
                  {missingPlansCount > 0 ? `${missingPlansCount} sans plan` : "Plans synchronisés"}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={repairMissingPlans}
                  disabled={repairingPlans || missingPlansCount === 0}
                >
                  <RefreshCcw className={`mr-2 h-4 w-4 ${repairingPlans ? "animate-spin" : ""}`} />
                  {repairingPlans ? "Correction..." : "Corriger les plans"}
                </Button>
                <Link to="/admin/salons">
                  <Button variant="outline" size="sm">Voir tout</Button>
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Établissement</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Plan</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("common.status")}</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t("common.date")}</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBusinesses.map((business) => (
                    <tr key={business.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                            {business.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-sm">{business.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-sm">
                          {business.planName}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          business.status === "inactive" ? "bg-destructive/20 text-destructive" :
                          business.status === "suspended" ? "bg-warning/20 text-warning" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {business.status === "inactive" ? "Suspendu" : business.status === "suspended" ? "Suspendu" : "Actif"}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">{business.created_at.split("T")[0].split("-").reverse().join("/")}</td>
                      <td className="p-4 text-right">
                        <Link to="/admin/salons">
                          <Button variant="ghost" size="sm" className="h-8">Gérer</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {recentBusinesses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm font-medium">Aucun établissement enregistré.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </StaggerItem>

        {/* Quick Stats Cards */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-success/10 text-success">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <span className="font-semibold text-sm">Abonnements actifs</span>
              </div>
              <p className="text-3xl font-bold font-display">{subscriptionStats.active}</p>
              <p className="text-xs text-muted-foreground mt-1">Accès total autorisé</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-warning/10 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <span className="font-semibold text-sm">Expirent bientôt</span>
              </div>
              <p className="text-3xl font-bold font-display">{subscriptionStats.expiringSoon}</p>
              <p className="text-xs text-muted-foreground mt-1">Dans les 7 prochains jours</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <span className="font-semibold text-sm">En retard</span>
              </div>
              <p className="text-3xl font-bold font-display">{subscriptionStats.pastDue}</p>
              <p className="text-xs text-muted-foreground mt-1">Paiements à régulariser</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-muted/50 text-muted-foreground">
                  <Gift className="h-5 w-5" />
                </div>
                <span className="font-semibold text-sm">Fidélité active</span>
              </div>
              <p className="text-3xl font-bold font-display">{platformCounts.loyaltyAccounts}</p>
              <p className="text-xs text-muted-foreground mt-1">{platformCounts.loyaltyRewards} récompenses configurées</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <BadgeDollarSign className="h-5 w-5" />
                </div>
                <span className="font-semibold text-sm">Créances ouvertes</span>
              </div>
              <p className="text-3xl font-bold font-display">{platformCounts.openDebts}</p>
              <p className="text-xs text-muted-foreground mt-1">Soldes clients à recouvrer</p>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
