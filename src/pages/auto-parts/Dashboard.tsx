import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  cashierDashboard,
  adminCashierStats,
  weeklyTrend,
  topProducts,
  categoryRepartition,
  getOutOfStockItems,
  getRecentActivity
} from "@/modules/auto-parts/services/reportsService";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DollarSign, ShoppingCart, FileText, Package,
  AlertTriangle, Users, TrendingUp, Truck, UserCheck, BookOpen, RefreshCw
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import type { WeeklyTrend } from "@/modules/auto-parts/types";



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

  const salesEvolution = useMemo(() => {
    return trend.map((w) => {
      const d = new Date(w.week_start + "T00:00:00");
      return {
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        total: w.total_sales ?? 0
      };
    });
  }, [trend]);

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
          <Card className="border-0 shadow-sm p-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Évolution du CA (7 dernières semaines)</p>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesEvolution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis hide />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${format(value)}`, 'CA']}
                    labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ businessId, isAdmin }: { businessId: string; isAdmin: boolean }) {
  const { format } = useCurrency();
  const { hasAutoPartsPermission, autoPartsStaffSession } = useAuth();
  const canViewStockValue = isAdmin || hasAutoPartsPermission(PERMISSIONS.STOCK_MANAGE);
  const canViewPurchases  = isAdmin || hasAutoPartsPermission(PERMISSIONS.PURCHASES_MANAGE);

  const [counts, setCounts] = useState({ totalProducts: 0, totalStockValue: 0, totalPotentialRevenue: 0, totalPotentialProfit: 0, outOfStock: 0, lowStock: 0, monthPurchases: 0 });
  const [adminStats, setAdminStats] = useState<{
    global: { salesToday: number; salesWeek: number; salesMonth: number; invoicesToday: number; invoicesWeek: number; invoicesMonth: number };
    byCashier: Array<{ staffId: string; staffName: string; salesToday: number; salesWeek: number; salesMonth: number; invoicesToday: number; invoicesWeek: number; invoicesTotal: number; itemsSoldMonth: number }>;
  } | null>(null);
  const [trend, setTrend] = useState<WeeklyTrend[]>([]);
  const [topProductsList, setTopProductsList] = useState<any[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<any[]>([]);
  const [categoryDist, setCategoryDist] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const COLORS = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#64748b"];

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }

    const safe = async <T,>(fn: () => Promise<T>, fallback: T, name: string): Promise<T> => {
      try { return await fn(); } catch (e) { console.warn(`Admin dashboard [${name}]:`, (e as any)?.message); return fallback; }
    };

    const load = async () => {
      const dashParams: Record<string, any> = { p_business_id: businessId, p_is_admin: isAdmin };
      if (autoPartsStaffSession?.session_token) {
        dashParams.p_session_token = autoPartsStaffSession.session_token;
      }

      const [c, a, t, tp, oos, cat, recent] = await Promise.all([
        safe(async () => { const r = await supabase.rpc("auto_parts_dashboard_counts", dashParams); return r.data; }, null, "counts"),
        safe(() => adminCashierStats(businessId), null, "cashier_stats"),
        safe(() => weeklyTrend(businessId, 12), [], "weekly_trend"),
        safe(() => topProducts(businessId, null, null, 5), [], "top_products"),
        safe(() => getOutOfStockItems(businessId, 10), [], "oos"),
        safe(() => categoryRepartition(businessId), [], "category_dist"),
        safe(() => getRecentActivity(businessId, 5), [], "recent"),
      ]);

      if (c) setCounts(c);
      if (a) setAdminStats(a as any);
      if (t) setTrend(t);
      if (tp) setTopProductsList(tp);
      if (oos) setOutOfStockItems(oos);
      if (cat) {
        const totalCount = cat.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
        const mapped = cat.map((item: any, idx: number) => ({
          name: item.name || "Sans catégorie",
          value: item.count,
          fill: COLORS[idx % COLORS.length],
          percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0
        }));
        setCategoryDist(mapped);
      }
      if (recent) setRecentActivity(recent);
      setLoading(false);
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [businessId, autoPartsStaffSession, isAdmin]);

  const salesEvolution = useMemo(() => {
    return trend.map((w) => {
      const d = new Date(w.week_start + "T00:00:00");
      return {
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        total: w.total_sales ?? 0
      };
    });
  }, [trend]);

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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vue d'ensemble Pièces Auto</p>
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
            value={g?.invoicesToday ?? 0}
            sub="Tickets émis"
            accent="violet"
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            label="Ventes du mois"
            value={g?.invoicesMonth ?? 0}
            sub="Total des tickets"
            accent="cyan"
          />
          <StatCard
            icon={<BookOpen className="h-5 w-5" />}
            label="Catalogue"
            value={counts.totalProducts ?? 0}
            sub="Produits référencés"
            accent="orange"
          />
        </div>
      </StaggerItem>

      {/* ── Alertes & KPIs Secondaires ── */}
      {(counts.outOfStock > 0 || counts.lowStock > 0 || canViewStockValue || (canViewPurchases && counts.monthPurchases > 0)) && (
        <StaggerItem>
          <div className="flex flex-wrap gap-3">
            {counts.outOfStock > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-900/30 bg-red-950/20 text-red-400 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span><strong>{counts.outOfStock}</strong> référence{counts.outOfStock > 1 ? "s" : ""} en rupture</span>
              </div>
            )}
            {counts.lowStock > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-900/30 bg-amber-950/20 text-amber-400 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span><strong>{counts.lowStock}</strong> référence{counts.lowStock > 1 ? "s" : ""} à stock faible</span>
              </div>
            )}
            {canViewStockValue && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-900/30 bg-blue-950/20 text-blue-400 text-sm font-medium">
                <Package className="h-4 w-4 flex-shrink-0" />
                <span>Valeur du stock : <strong>{format(counts.totalStockValue)}</strong></span>
              </div>
            )}
            {canViewStockValue && counts.totalPotentialRevenue > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-900/30 bg-emerald-950/20 text-emerald-400 text-sm font-medium">
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                <span>Valeur potentielle : <strong>{format(counts.totalPotentialRevenue)}</strong></span>
              </div>
            )}
            {canViewStockValue && counts.totalPotentialProfit > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-purple-900/30 bg-purple-950/20 text-purple-400 text-sm font-medium">
                <DollarSign className="h-4 w-4 flex-shrink-0" />
                <span>Marge potentielle : <strong>{format(counts.totalPotentialProfit)}</strong></span>
              </div>
            )}
            {canViewPurchases && counts.monthPurchases > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-indigo-900/30 bg-indigo-950/20 text-indigo-400 text-sm font-medium">
                <Truck className="h-4 w-4 flex-shrink-0" />
                <span>Achats ce mois : <strong>{format(counts.monthPurchases)}</strong></span>
              </div>
            )}
          </div>
        </StaggerItem>
      )}

      {/* ── Graphique d'évolution des ventes ── */}
      {trend.length > 0 && (
        <StaggerItem>
          <Card className="border-0 shadow-sm p-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">Évolution hebdomadaire du CA (12 semaines)</p>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesEvolution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis hide />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${format(value)}`, 'CA']}
                    labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </StaggerItem>
      )}

      {/* ── 3 Colonnes : Top, Ruptures, Catégories ── */}
      <StaggerItem>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Top Produits */}
          <Card className="border-0 shadow-sm p-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Top Produits</p>
            <div className="space-y-4">
              {topProductsList.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Pas assez de données.</p>}
              {topProductsList.slice(0, 5).map((p, i) => {
                const maxQty = topProductsList[0]?.quantity || 1;
                const pct = Math.round((p.quantity / maxQty) * 100);
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium truncate pr-2">{p.product_name}</span>
                      <span className="text-muted-foreground flex-shrink-0">{p.quantity} ventes</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Ruptures */}
          <Card className="border-0 shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Rupture de Stock</p>
              <span className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">{counts.outOfStock}</span>
            </div>
            <div className="space-y-3">
              {outOfStockItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune rupture.</p>}
              {outOfStockItems.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="font-medium truncate pr-2">{p.name}</span>
                  <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors flex-shrink-0">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Catégories */}
          <Card className="border-0 shadow-sm p-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Par Catégorie</p>
            <div className="flex items-center justify-between">
              <div className="h-[120px] w-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDist}
                      innerRadius={40}
                      outerRadius={55}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number, name: string) => [`${value} articles`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 pl-4 space-y-2">
                {categoryDist.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-center text-xs">
                    <div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: c.fill }} />
                    <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
                    <span className="font-medium ml-2">{c.percentage}%</span>
                  </div>
                ))}
                {categoryDist.length > 3 && (
                  <div className="flex items-center text-xs">
                    <div className="h-2 w-2 rounded-full mr-2 bg-muted-foreground" />
                    <span className="flex-1 truncate text-muted-foreground">Autres</span>
                    <span className="font-medium ml-2">
                      {categoryDist.slice(3).reduce((acc, c) => acc + c.percentage, 0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>

        </div>
      </StaggerItem>

      {/* ── Activité Récente ── */}
      <StaggerItem>
        <Card className="border-0 shadow-sm p-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Activité Récente</p>
          <div className="space-y-0">
            {recentActivity.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune vente récente.</p>}
            {recentActivity.map((act, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 text-sm">
                <div className="w-16 text-muted-foreground">{act.time}</div>
                <div className="flex-1 font-medium">Ticket #{act.invoice}</div>
                <div className="w-16 text-center text-muted-foreground">{act.initials}</div>
                <div className="w-24 text-right font-medium text-emerald-500">{format(act.amount)}</div>
              </div>
            ))}
          </div>
        </Card>
      </StaggerItem>

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
                          <Badge variant="outline" className="font-normal">{c.salesMonth}</Badge>
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

    </StaggerContainer>
  );
}

export default function AutoPartsDashboardPage() {
  const businessId = useAutoPartsBusinessId();
  const { autoPartsStaffSession, hasAutoPartsPermission, profile, session } = useAuth();

  // Un admin Supabase est connecté si session ET profile existent,
  // OU si session existe mais profile pas encore chargé (cas APK : on fait confiance à la session)
  const isSupabaseAdmin = !!session;

  // Si l'utilisateur a la permission de voir les rapports globaux (Admins, Gérants),
  // il voit toujours le tableau de bord administrateur, même s'il a une session caissier active.
  const canViewAdminDashboard = isSupabaseAdmin || hasAutoPartsPermission(PERMISSIONS.REPORTS_VIEW);
  
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
        <AdminDashboard businessId={businessId} isAdmin={isSupabaseAdmin} />
      )}
    </DashboardLayout>
  );
}
