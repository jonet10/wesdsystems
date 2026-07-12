import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ShoppingCart } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar, Clock, CreditCard, DollarSign, TrendingUp, Wallet, AlertTriangle, Package, PieChart as PieChartIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { normalizeEmployeeRole, canAccessEmployeePos } from "@/lib/employee-role";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import {
  DEFAULT_PLATFORM_TIME_ZONE,
  getDateKeyInTimeZone,
  getDayRangeInTimeZone,
  shiftDateKey,
} from "@/lib/timezone-date";

interface EmployeeSale {
  id: string;
  sale_number: string | null;
  total_amount: number;
  payment_method: string | null;
  customer_name: string | null;
  created_at: string;
}

interface EmployeeCommission {
  gross_revenue: number;
  commission_total: number;
  transaction_count: number;
}

const paymentLabels: Record<string, string> = {
  cash: "Espèces",
  moncash: "MonCash",
  natcash: "NatCash",
  card: "Carte",
  mixed: "Mixte",
};

// Reusable stat card adapted from Papeterie module
function ColoredStatCard({
  icon, label, value, sub, accent = "indigo",
}: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string;
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

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { employeeSession, user, profile, isAuthenticated } = useAuth();
  const role = normalizeEmployeeRole(employeeSession?.role) || "cashier";
  const employeeId = employeeSession?.id || null;
  const branchId = employeeSession?.branch_id || null;

  const [resolvedEmployeeId, setResolvedEmployeeId] = useState<string | null>(employeeId);
  const [resolvedBranchId, setResolvedBranchId] = useState<string | null>(branchId);
  const [employeeLookupDone, setEmployeeLookupDone] = useState(!!employeeId);

  useEffect(() => {
    if (employeeId && branchId) {
      setResolvedEmployeeId(employeeId);
      setResolvedBranchId(branchId);
      setEmployeeLookupDone(true);
      return;
    }

    if (!employeeId && isAuthenticated && profile?.role === "employee" && user?.id) {
      supabase
        .from("salon_employees")
        .select("id, branch_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setResolvedEmployeeId(data.id);
            setResolvedBranchId(data.branch_id);
          } else {
            setLoading(false);
          }
          setEmployeeLookupDone(true);
        });
    } else if (!employeeId) {
      setLoading(false);
      setEmployeeLookupDone(true);
    }
  }, [employeeId, branchId, isAuthenticated, profile?.role, user?.id]);

  const [loading, setLoading] = useState(true);
  const [salesToday, setSalesToday] = useState<EmployeeSale[]>([]);
  const [daySummary, setDaySummary] = useState({ revenue: 0, tickets: 0 });
  const [weekSummary, setWeekSummary] = useState({ revenue: 0, tickets: 0 });
  const [monthSummary, setMonthSummary] = useState({ revenue: 0, tickets: 0 });
  const [evolution, setEvolution] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [outOfStock, setOutOfStock] = useState<any[]>([]);
  const [categoryDist, setCategoryDist] = useState<any[]>([]);
  const [commissionDay, setCommissionDay] = useState<EmployeeCommission>({ gross_revenue: 0, commission_total: 0, transaction_count: 0 });
  const [commissionWeek, setCommissionWeek] = useState<EmployeeCommission>({ gross_revenue: 0, commission_total: 0, transaction_count: 0 });
  const [commissionMonth, setCommissionMonth] = useState<EmployeeCommission>({ gross_revenue: 0, commission_total: 0, transaction_count: 0 });

  useEffect(() => {
    const loadEmployeeData = async () => {
      if (!resolvedEmployeeId || !resolvedBranchId) return;

      setLoading(true);
      try {
        const now = new Date();
        const timeZone = DEFAULT_PLATFORM_TIME_ZONE;
        const todayKey = getDateKeyInTimeZone(now, timeZone);
        const weekStartKey = shiftDateKey(todayKey, -6);
        const monthStartKey = `${todayKey.slice(0, 7)}-01`;
        const todayRange = getDayRangeInTimeZone(todayKey, timeZone);
        const weekStartRange = getDayRangeInTimeZone(weekStartKey, timeZone);
        const monthStartRange = getDayRangeInTimeZone(monthStartKey, timeZone);

        if (role === "cashier" || role === "manager") {
          // Use RPC for PIN login sessions (bypasses RLS for anon key)
          if (employeeSession?.session_token) {
            const { data, error } = await supabase.rpc("get_employee_dashboard_stats", {
              p_session_token: employeeSession.session_token,
              p_branch_id: resolvedBranchId,
            });

            if (error) throw error;

            setSalesToday((data?.today_sales || []) as EmployeeSale[]);
            setDaySummary({ revenue: Number(data?.day?.revenue || 0), tickets: Number(data?.day?.tickets || 0) });
            setWeekSummary({ revenue: Number(data?.week?.revenue || 0), tickets: Number(data?.week?.tickets || 0) });
            setMonthSummary({ revenue: Number(data?.month?.revenue || 0), tickets: Number(data?.month?.tickets || 0) });
            if (data?.evolution) setEvolution(data.evolution);
            if (data?.top_products) setTopProducts(data.top_products);
            if (data?.out_of_stock) setOutOfStock(data.out_of_stock);
            if (data?.category_dist) setCategoryDist(data.category_dist);
          } else {
            const [{ data: todaySales }, { data: weekSales }, { data: monthSales }] = await Promise.all([
              supabase
                .from("salon_sales")
                .select("id, sale_number, total_amount, payment_method, customer_name, created_at")
                .eq("branch_id", resolvedBranchId)
                .eq("cashier_id", resolvedEmployeeId)
                .gte("created_at", todayRange.start)
                .lte("created_at", todayRange.end)
                .order("created_at", { ascending: false }),
              supabase
                .from("salon_sales")
                .select("id, total_amount, created_at")
                .eq("branch_id", resolvedBranchId)
                .eq("cashier_id", resolvedEmployeeId)
                .gte("created_at", weekStartRange.start)
                .lte("created_at", todayRange.end),
              supabase
                .from("salon_sales")
                .select("id, total_amount, created_at")
                .eq("branch_id", resolvedBranchId)
                .eq("cashier_id", resolvedEmployeeId)
                .gte("created_at", monthStartRange.start)
                .lte("created_at", todayRange.end),
            ]);

            const totalRevenueToday = (todaySales || []).reduce((sum, sale: any) => sum + Number(sale.total_amount || 0), 0);
            const totalRevenueWeek = (weekSales || []).reduce((sum, sale: any) => sum + Number(sale.total_amount || 0), 0);
            const totalRevenueMonth = (monthSales || []).reduce((sum, sale: any) => sum + Number(sale.total_amount || 0), 0);

            setSalesToday((todaySales || []) as EmployeeSale[]);
            setDaySummary({ revenue: totalRevenueToday, tickets: (todaySales || []).length });
            setWeekSummary({ revenue: totalRevenueWeek, tickets: (weekSales || []).length });
            setMonthSummary({ revenue: totalRevenueMonth, tickets: (monthSales || []).length });
          }
        } else {
          const [{ data: dayRows }, { data: weekRows }, { data: monthRows }] = await Promise.all([
            supabase
              .from("commission_transactions")
              .select("sale_amount, commission_amount")
              .eq("employee_id", resolvedEmployeeId)
              .eq("branch_id", resolvedBranchId)
              .gte("calculated_at", todayRange.start)
              .lte("calculated_at", todayRange.end)
              .neq("status", "cancelled"),
            supabase
              .from("commission_transactions")
              .select("sale_amount, commission_amount")
              .eq("employee_id", resolvedEmployeeId)
              .eq("branch_id", resolvedBranchId)
              .gte("calculated_at", weekStartKey)
              .lte("calculated_at", todayRange.end)
              .neq("status", "cancelled"),
            supabase
              .from("commission_transactions")
              .select("sale_amount, commission_amount")
              .eq("employee_id", resolvedEmployeeId)
              .eq("branch_id", resolvedBranchId)
              .gte("calculated_at", monthStartKey)
              .lte("calculated_at", todayRange.end)
              .neq("status", "cancelled"),
          ]);

          const pick = (rows: any[] | null | undefined): EmployeeCommission => ({
            gross_revenue: (rows || []).reduce((sum, row) => sum + Number(row.sale_amount || 0), 0),
            commission_total: (rows || []).reduce((sum, row) => sum + Number(row.commission_amount || 0), 0),
            transaction_count: (rows || []).length,
          });

          setCommissionDay(pick(dayRows));
          setCommissionWeek(pick(weekRows));
          setCommissionMonth(pick(monthRows));
        }
      } finally {
        setLoading(false);
      }
    };

    void loadEmployeeData();
  }, [resolvedBranchId, resolvedEmployeeId, role, employeeSession?.session_token]);

  const stats = useMemo(() => {
    if (role === "cashier" || role === "manager") {
      return [
        { label: "Ventes du jour", value: daySummary.revenue ? format(daySummary.revenue) : format(0), sub: "Total encaissé", icon: <DollarSign className="h-5 w-5" />, accent: "green" },
        { label: "Tickets du jour", value: daySummary.tickets.toString(), sub: "Transactions effectuées", icon: <ShoppingCart className="h-5 w-5" />, accent: "violet" },
        { label: "Ventes semaine", value: format(weekSummary.revenue), sub: "Les 7 derniers jours", icon: <TrendingUp className="h-5 w-5" />, accent: "blue" },
        { label: "Ventes mois", value: format(monthSummary.revenue), sub: "Mois en cours", icon: <CreditCard className="h-5 w-5" />, accent: "cyan" },
      ] as any[];
    }

    return [
      { label: "Commission du jour", value: format(commissionDay.commission_total), sub: "Ventes: " + format(commissionDay.gross_revenue), icon: <Wallet className="h-5 w-5" />, accent: "green" },
      { label: "Commission semaine", value: format(commissionWeek.commission_total), sub: "Ventes: " + format(commissionWeek.gross_revenue), icon: <TrendingUp className="h-5 w-5" />, accent: "blue" },
      { label: "Commission mois", value: format(commissionMonth.commission_total), sub: "Ventes: " + format(commissionMonth.gross_revenue), icon: <DollarSign className="h-5 w-5" />, accent: "cyan" },
      { label: "Transactions", value: commissionMonth.transaction_count.toString(), sub: "Opérations du mois", icon: <Clock className="h-5 w-5" />, accent: "orange" },
    ] as any[];
  }, [commissionDay.commission_total, commissionMonth.commission_total, commissionMonth.transaction_count, commissionWeek.commission_total, daySummary.revenue, daySummary.tickets, format, monthSummary.revenue, role, weekSummary.revenue]);

  if (!employeeLookupDone) {
    return (
      <DashboardLayout role="employee" title="Mon Dashboard" subtitle="Chargement..." userName={employeeSession?.full_name || "Employé"}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (loading && resolvedEmployeeId && resolvedBranchId) {
    return (
      <DashboardLayout role="employee" title="Mon Dashboard" subtitle="Chargement..." userName={employeeSession?.full_name || "Employé"}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="employee"
      title={role === "barber" ? "Mes gains" : "Dashboard caisse"}
      subtitle={role === "barber" ? "Suivi de vos commissions" : "Rapport journalier et caisse"}
      userName={employeeSession?.full_name || "Employé"}
    >
      <StaggerContainer className="space-y-8">
        <StaggerItem>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{employeeSession?.full_name || "Employé"}</h2>
              <p className="text-muted-foreground capitalize">
                Poste: {role || "employé"} • {employeeSession?.branch_id ? "Branche active" : "Branche inconnue"}
              </p>
            </div>
            {(role === "cashier" || role === "manager") && canAccessEmployeePos(employeeSession?.role) && (
              <Button onClick={() => navigate("/employee/pos")} className="gap-2">
                Ouvrir la caisse <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <ColoredStatCard key={index} {...stat} />
            ))}
          </div>
        </StaggerItem>

        {role === "cashier" || role === "manager" ? (
          <>
            <StaggerItem>
              <Card className="border-0 shadow-sm p-2">
                <CardHeader className="pb-3 pt-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Rapport journalier</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {salesToday.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune vente enregistrée aujourd'hui.</p>
                  ) : (
                    salesToday.slice(0, 8).map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{sale.customer_name || "Client sans nom"}</p>
                          <p className="text-xs text-muted-foreground">
                            {sale.sale_number || sale.id.slice(0, 8)} • {paymentLabels[sale.payment_method || "cash"] || sale.payment_method || "Espèces"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{format(Number(sale.total_amount || 0))}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(sale.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_PLATFORM_TIME_ZONE })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {(role === "manager" || evolution.length > 0) && (
              <StaggerItem>
                <Card className="border-0 shadow-sm p-4">
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Evolution des ventes (7 Jours)</p>
                  </div>
                  <div className="h-[250px] w-full">
                    {evolution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evolution}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [`${format(value)}`, 'Ventes']}
                            labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                          />
                          <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        Données en attente de mise à jour...
                      </div>
                    )}
                  </div>
                </Card>
              </StaggerItem>
            )}

            <StaggerItem>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-0 shadow-sm p-4">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Top Ventes</p>
                  <div className="space-y-4">
                    {topProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Pas assez de données.</p>}
                    {topProducts.map((p, i) => {
                      const maxQty = topProducts[0]?.quantity || 1;
                      const pct = Math.round((p.quantity / maxQty) * 100);
                      return (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium truncate pr-2">{p.name}</span>
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

                {role === "manager" && (
                  <Card className="border-0 shadow-sm p-4">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Rupture de stock</p>
                    <div className="space-y-3">
                      {outOfStock.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                          <Package className="h-8 w-8 mb-2 opacity-20" />
                          <p className="text-sm">Stock optimal</p>
                        </div>
                      ) : (
                        outOfStock.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                            <span className="font-medium truncate">{item.name}</span>
                            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                )}

                <Card className={`border-0 shadow-sm p-4 ${role !== "manager" ? "md:col-span-2" : ""}`}>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Par Catégorie</p>
                  {categoryDist.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Pas assez de données.</p>
                  ) : (
                    <div className="flex items-center justify-center h-[180px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryDist}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {categoryDist.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#34d399', '#8b5cf6', '#ffb224', '#38bdf8', '#fb7185'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => format(value)}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col gap-2 right-4">
                        {categoryDist.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ['#34d399', '#8b5cf6', '#ffb224', '#38bdf8', '#fb7185'][index % 5] }} />
                            <span className="text-muted-foreground">{entry.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </StaggerItem>
          </>
        ) : (
          <>
            <StaggerItem>
              <Card className="border-0 shadow-sm p-2">
                <CardHeader className="pb-3 pt-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Mes commissions (Détails)</p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "Jour", data: commissionDay },
                    { label: "Semaine", data: commissionWeek },
                    { label: "Mois", data: commissionMonth },
                  ].map((block) => (
                    <div key={block.label} className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-1">
                      <p className="text-sm font-medium">{block.label}</p>
                      <p className="text-xs text-muted-foreground">Ventes: {format(block.data.gross_revenue)}</p>
                      <p className="text-lg font-bold text-primary">{format(block.data.commission_total)}</p>
                      <p className="text-xs text-muted-foreground">{block.data.transaction_count} transaction{block.data.transaction_count > 1 ? "s" : ""}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </StaggerItem>
          </>
        )}
      </StaggerContainer>
    </DashboardLayout>
  );
}
