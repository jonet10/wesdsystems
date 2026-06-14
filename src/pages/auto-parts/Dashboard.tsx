import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cashierDashboard, adminCashierStats, weeklyTrend } from "@/modules/auto-parts/services/reportsService";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DollarSign, ShoppingCart, FileText, Package,
  AlertTriangle, Users, TrendingUp, Truck, UserCheck,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { WeeklyTrend } from "@/modules/auto-parts/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ─── Reusable stat card with accent bar ──────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  accent = "indigo",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "indigo" | "green" | "cyan" | "orange" | "violet" | "amber" | "rose" | "teal";
}) {
  const accents: Record<string, { bar: string; bg: string; icon: string }> = {
    indigo: { bar: "bg-indigo-500",  bg: "bg-indigo-50 dark:bg-indigo-500/10",  icon: "text-indigo-600 dark:text-indigo-400" },
    green:  { bar: "bg-green-500",   bg: "bg-green-50 dark:bg-green-500/10",   icon: "text-green-600 dark:text-green-400" },
    cyan:   { bar: "bg-cyan-500",    bg: "bg-cyan-50 dark:bg-cyan-500/10",    icon: "text-cyan-600 dark:text-cyan-400" },
    orange: { bar: "bg-orange-500",  bg: "bg-orange-50 dark:bg-orange-500/10",  icon: "text-orange-600 dark:text-orange-400" },
    violet: { bar: "bg-violet-500",  bg: "bg-violet-50 dark:bg-violet-500/10",  icon: "text-violet-600 dark:text-violet-400" },
    amber:  { bar: "bg-amber-500",   bg: "bg-amber-50 dark:bg-amber-500/10",   icon: "text-amber-600 dark:text-amber-400" },
    rose:   { bar: "bg-rose-500",    bg: "bg-rose-50 dark:bg-rose-500/10",    icon: "text-rose-600 dark:text-rose-400" },
    teal:   { bar: "bg-teal-500",    bg: "bg-teal-50 dark:bg-teal-500/10",    icon: "text-teal-600 dark:text-teal-400" },
  };
  const c = accents[accent] ?? accents.indigo;
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${c.bar}`} />
      <CardContent className="pt-4 pb-4 pl-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            <p className="text-2xl font-bold mt-1 font-display">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
            <span className={c.icon}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Cashier Dashboard ────────────────────────────────────────────────────────
function CashierDashboard({ businessId, staffId, staffName }: { businessId: string; staffId: string; staffName: string }) {
  const { format } = useCurrency();
  const [data, setData] = useState<{
    salesToday: number; salesWeek: number;
    invoicesToday: number;
    revenueToday: number; revenueWeek: number; revenueMonth: number;
    itemsSoldToday: number;
  } | null>(null);
  const [trend, setTrend] = useState<WeeklyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [d, t] = await Promise.all([
          cashierDashboard(businessId, staffId),
          weeklyTrend(businessId, 7).catch(() => [] as WeeklyTrend[]),
        ]);
        setData(d);
        setTrend(t);
      } catch (e) {
        console.warn("Cashier dashboard:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [businessId, staffId]);

  const chartData = useMemo(() => ({
    labels: trend.map((w) => {
      const d = new Date(w.week_start + "T00:00:00");
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }),
    datasets: [{
      label: "CA (HTG)",
      data: trend.map((w) => w.total_sales ?? 0),
      backgroundColor: "rgba(99, 102, 241, 0.7)",
      borderRadius: 6,
      borderSkipped: false,
    }],
  }), [trend]);

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-24 animate-pulse bg-muted/40 border-0 shadow-sm" />
        ))}
      </div>
    );
  }

  return (
    <StaggerContainer className="space-y-6">
      {/* Header */}
      <StaggerItem>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{staffName}</h2>
            <p className="text-xs text-muted-foreground capitalize">{today}</p>
          </div>
        </div>
      </StaggerItem>

      {/* 4 KPIs — aujourd'hui uniquement */}
      <StaggerItem>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<DollarSign className="h-5 w-5" />}
            label="CA aujourd'hui"
            value={format(data?.revenueToday ?? 0)}
            sub="Ventes actives"
            accent="green"
          />
          <StatCard
            icon={<ShoppingCart className="h-5 w-5" />}
            label="Ventes aujourd'hui"
            value={data?.salesToday ?? 0}
            sub="Transactions"
            accent="indigo"
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            label="Factures aujourd'hui"
            value={data?.invoicesToday ?? 0}
            sub="Émises"
            accent="cyan"
          />
          <StatCard
            icon={<Package className="h-5 w-5" />}
            label="Produits vendus"
            value={data?.itemsSoldToday ?? 0}
            sub="Quantités"
            accent="orange"
          />
        </div>
      </StaggerItem>

      {/* Graphique 7 semaines */}
      {trend.length > 0 && (
        <StaggerItem>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Évolution du CA (7 dernières semaines)</CardTitle>
            </CardHeader>
            <CardContent>
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => ` ${Number(ctx.raw).toLocaleString("fr-FR")} HTG`,
                      },
                    },
                  },
                  scales: {
                    x: { grid: { display: false } },
                    y: {
                      beginAtZero: true,
                      grid: { color: "rgba(0,0,0,0.04)" },
                      ticks: { callback: (v) => `${Number(v).toLocaleString()} G` },
                    },
                  },
                }}
              />
            </CardContent>
          </Card>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ businessId }: { businessId: string }) {
  const { format } = useCurrency();
  const { hasAutoPartsPermission, autoPartsStaffSession } = useAuth();
  const canViewStockValue = hasAutoPartsPermission(PERMISSIONS.STOCK_MANAGE);
  const canViewPurchases  = hasAutoPartsPermission(PERMISSIONS.PURCHASES_MANAGE);

  const [counts, setCounts] = useState({ totalProducts: 0, totalStockValue: 0, outOfStock: 0, lowStock: 0, monthPurchases: 0 });
  const [adminStats, setAdminStats] = useState<{
    global: { salesToday: number; salesWeek: number; salesMonth: number; invoicesToday: number; invoicesWeek: number; invoicesMonth: number };
    byCashier: Array<{ staffId: string; staffName: string; salesToday: number; salesWeek: number; salesMonth: number; invoicesToday: number; invoicesWeek: number; invoicesTotal: number; itemsSoldMonth: number }>;
  } | null>(null);
  const [trend, setTrend] = useState<WeeklyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }

    const safe = async <T,>(fn: () => Promise<T>, fallback: T, name: string): Promise<T> => {
      try { return await fn(); } catch (e) { console.warn(`Admin dashboard [${name}]:`, (e as any)?.message); return fallback; }
    };

    const load = async () => {
      const dashParams: Record<string, any> = { p_business_id: businessId };
      if (autoPartsStaffSession?.session_token) dashParams.p_session_token = autoPartsStaffSession.session_token;

      const [c, a, t] = await Promise.all([
        safe(async () => { const r = await supabase.rpc("auto_parts_dashboard_counts", dashParams); return r.data; }, null, "counts"),
        safe(() => adminCashierStats(businessId), null, "cashier_stats"),
        safe(() => weeklyTrend(businessId, 12), [], "weekly_trend"),
      ]);

      if (c) setCounts(c);
      if (a) setAdminStats(a as any);
      if (t) setTrend(t);
      setLoading(false);
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [businessId, autoPartsStaffSession]);

  const chartData = useMemo(() => ({
    labels: trend.map((w) => {
      const d = new Date(w.week_start + "T00:00:00");
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }),
    datasets: [{
      label: "CA (HTG)",
      data: trend.map((w) => w.total_sales ?? 0),
      backgroundColor: "rgba(99, 102, 241, 0.7)",
      borderRadius: 6,
      borderSkipped: false,
    }],
  }), [trend]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Card key={i} className="h-24 animate-pulse bg-muted/40 border-0 shadow-sm" />)}
        </div>
      </div>
    );
  }

  const g = adminStats?.global;

  return (
    <StaggerContainer className="space-y-6">

      {/* ── 5 KPIs essentiels ── */}
      <StaggerItem>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vue d'ensemble</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            icon={<DollarSign className="h-5 w-5" />}
            label="CA aujourd'hui"
            value={format(g?.salesToday ?? 0)}
            sub="Ventes actives"
            accent="green"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="CA du mois"
            value={format(g?.salesMonth ?? 0)}
            sub="Mois en cours"
            accent="indigo"
          />
          <StatCard
            icon={<ShoppingCart className="h-5 w-5" />}
            label="Ventes aujourd'hui"
            value={g?.salesToday !== undefined ? (g.invoicesToday ?? 0) : 0}
            sub="Transactions"
            accent="violet"
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            label="Factures du mois"
            value={g?.invoicesMonth ?? 0}
            sub="Émises"
            accent="cyan"
          />
          <StatCard
            icon={<Package className="h-5 w-5" />}
            label="Produits vendus"
            value={adminStats?.byCashier?.reduce((s, c) => s + (c.itemsSoldMonth ?? 0), 0) ?? 0}
            sub="Ce mois"
            accent="orange"
          />
        </div>
      </StaggerItem>

      {/* ── Alertes & KPIs Secondaires ── */}
      {(counts.outOfStock > 0 || counts.lowStock > 0 || canViewStockValue || (canViewPurchases && counts.monthPurchases > 0)) && (
        <StaggerItem>
          <div className="flex flex-wrap gap-3">
            {counts.outOfStock > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span><strong>{counts.outOfStock}</strong> référence{counts.outOfStock > 1 ? "s" : ""} en rupture</span>
              </div>
            )}
            {counts.lowStock > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span><strong>{counts.lowStock}</strong> référence{counts.lowStock > 1 ? "s" : ""} à stock faible</span>
              </div>
            )}
            {canViewStockValue && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-sm">
                <Package className="h-4 w-4 flex-shrink-0" />
                <span>Valeur du stock : <strong>{format(counts.totalStockValue)}</strong></span>
              </div>
            )}
            {canViewPurchases && counts.monthPurchases > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400 text-sm">
                <Truck className="h-4 w-4 flex-shrink-0" />
                <span>Achats ce mois : <strong>{format(counts.monthPurchases)}</strong></span>
              </div>
            )}
          </div>
        </StaggerItem>
      )}

      {/* ── Performance caissiers ── */}
      {adminStats?.byCashier && adminStats.byCashier.length > 0 && (
        <StaggerItem>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Performance des caissiers — ce mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 px-2 text-left text-xs font-medium text-muted-foreground">Caissier</th>
                      <th className="pb-2 px-2 text-right text-xs font-medium text-muted-foreground">Ventes</th>
                      <th className="pb-2 px-2 text-right text-xs font-medium text-muted-foreground">Factures</th>
                      <th className="pb-2 px-2 text-right text-xs font-medium text-muted-foreground">Produits vendus</th>
                      <th className="pb-2 px-2 text-right text-xs font-medium text-muted-foreground">Chiffre d'affaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {adminStats.byCashier.map((c, idx) => (
                      <tr key={`${c.staffId}-${idx}`} className={`hover:bg-muted/30 transition-colors ${idx === 0 ? "font-medium" : ""}`}>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-400 text-xs font-bold flex-shrink-0">
                              {c.staffName.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{c.staffName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Badge variant="outline" className="font-normal">{c.invoicesTotal}</Badge>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Badge variant="outline" className="font-normal">{c.invoicesTotal}</Badge>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Badge variant="secondary" className="font-normal">{c.itemsSoldMonth ?? 0}</Badge>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                          {format(c.salesMonth)}
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

      {/* ── Graphique tendance CA ── */}
      {trend.length > 0 && (
        <StaggerItem>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Évolution du chiffre d'affaires (12 semaines)</CardTitle>
            </CardHeader>
            <CardContent>
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => ` ${Number(ctx.raw).toLocaleString("fr-FR")} HTG`,
                      },
                    },
                  },
                  scales: {
                    x: { grid: { display: false } },
                    y: {
                      beginAtZero: true,
                      grid: { color: "rgba(0,0,0,0.04)" },
                      ticks: { callback: (v) => `${Number(v).toLocaleString()} G` },
                    },
                  },
                }}
              />
            </CardContent>
          </Card>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}

export default function AutoPartsDashboardPage() {
  const businessId = useAutoPartsBusinessId();
  const { autoPartsStaffSession, hasAutoPartsPermission } = useAuth();

  // Si l'utilisateur a la permission de voir les rapports globaux (Admins, Gérants),
  // il voit toujours le tableau de bord administrateur, même s'il a une session caissier active.
  const canViewAdminDashboard = hasAutoPartsPermission(PERMISSIONS.REPORTS_VIEW);
  
  const isStrictlyCashier = !canViewAdminDashboard && autoPartsStaffSession?.role === "cashier";

  return (
    <DashboardLayout
      role="salon_admin"
      title="Tableau de bord"
      subtitle={isStrictlyCashier ? `Caissier — ${autoPartsStaffSession?.name}` : "Vue administrateur"}
    >
      {isStrictlyCashier && autoPartsStaffSession ? (
        <CashierDashboard
          businessId={businessId}
          staffId={autoPartsStaffSession.id}
          staffName={autoPartsStaffSession.name}
        />
      ) : (
        <AdminDashboard businessId={businessId} />
      )}
    </DashboardLayout>
  );
}
