import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar, Clock, CreditCard, DollarSign, TrendingUp, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { normalizeEmployeeRole, canAccessEmployeePos } from "@/lib/employee-role";
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

        if (role === "cashier") {
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
              .gte("calculated_at", weekStartRange.start)
              .lte("calculated_at", todayRange.end)
              .neq("status", "cancelled"),
            supabase
              .from("commission_transactions")
              .select("sale_amount, commission_amount")
              .eq("employee_id", resolvedEmployeeId)
              .eq("branch_id", resolvedBranchId)
              .gte("calculated_at", monthStartRange.start)
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
    if (role === "cashier") {
      return [
        { title: "Ventes du jour", value: daySummary.revenue ? format(daySummary.revenue) : format(0), icon: <CreditCard className="h-6 w-6" /> },
        { title: "Tickets du jour", value: daySummary.tickets.toString(), icon: <Calendar className="h-6 w-6" /> },
        { title: "Semaine", value: format(weekSummary.revenue), icon: <TrendingUp className="h-6 w-6" /> },
        { title: "Mois", value: format(monthSummary.revenue), icon: <DollarSign className="h-6 w-6" /> },
      ];
    }

    return [
      { title: "Commission du jour", value: format(commissionDay.commission_total), icon: <Wallet className="h-6 w-6" /> },
      { title: "Commission semaine", value: format(commissionWeek.commission_total), icon: <TrendingUp className="h-6 w-6" /> },
      { title: "Commission mois", value: format(commissionMonth.commission_total), icon: <DollarSign className="h-6 w-6" /> },
      { title: "Transactions", value: commissionMonth.transaction_count.toString(), icon: <Clock className="h-6 w-6" /> },
    ];
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
            {role === "cashier" && canAccessEmployeePos(employeeSession?.role) && (
              <Button onClick={() => navigate("/employee/pos")} className="gap-2">
                Ouvrir la caisse <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        </StaggerItem>

        {role === "cashier" ? (
          <>
            <StaggerItem>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <p className="text-sm text-muted-foreground">Ventes jour</p>
                  <p className="text-2xl font-bold">{format(daySummary.revenue)}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-6">
                  <p className="text-sm text-muted-foreground">Ventes semaine</p>
                  <p className="text-2xl font-bold">{format(weekSummary.revenue)}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-6">
                  <p className="text-sm text-muted-foreground">Ventes mois</p>
                  <p className="text-2xl font-bold">{format(monthSummary.revenue)}</p>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Rapport journalier</CardTitle>
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
          </>
        ) : (
          <>
            <StaggerItem>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <p className="text-sm text-muted-foreground">Revenus jour</p>
                  <p className="text-2xl font-bold">{format(commissionDay.gross_revenue)}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-6">
                  <p className="text-sm text-muted-foreground">Revenus semaine</p>
                  <p className="text-2xl font-bold">{format(commissionWeek.gross_revenue)}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-6">
                  <p className="text-sm text-muted-foreground">Revenus mois</p>
                  <p className="text-2xl font-bold">{format(commissionMonth.gross_revenue)}</p>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Mes commissions</CardTitle>
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
