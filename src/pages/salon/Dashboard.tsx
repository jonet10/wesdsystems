import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Users, Clock, Plus, TrendingUp, DollarSign,
  Scissors, Beer, Package, ShoppingBag, ArrowRight,
  CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { glowupStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { useActiveBranchId } from "@/lib/branch";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { CreditCard } from "lucide-react";
import { useSubscriptionPaymentReminder } from "@/hooks/useSubscriptionPaymentReminder";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

interface DashboardStat {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color?: string;
}

export default function SalonDashboard() {
  const { isAuthenticated, profile } = useAuth();
  const { formatCompact, format } = useCurrency();
  const subscriptionReminder = useSubscriptionPaymentReminder();
  const { data: branches = [], isFetching: branchesFetching } = useBusinessBranches();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const activeBranchId = useMemo(() => {
    const validBranchId = branchId && branches.some((branch) => branch.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches]);
  const isBranchInitialising = Boolean(isAuthenticated && branchesFetching);

  const [activeBiz, setActiveBiz] = useState(glowupStore.getActiveBusiness());
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; revenue: number; appointments: number }[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const isDataLoading = dashboardLoading;

  useEffect(() => {
    if (!isAuthenticated) {
      setClients(glowupStore.getClients());
      setEmployees(glowupStore.getEmployees());
      setAppointments(glowupStore.getAppointments());
      setServices(glowupStore.getServices());
      return;
    }

    const loadDashboardData = async () => {
      setDashboardLoading(true);
      try {
        if (!activeBranchId) {
          setClients([]);
          setEmployees([]);
          setAppointments([]);
          setServices([]);
          setTodaySales([]);
          setTodayRevenue(0);
          setRecentSales([]);
          setLowStockCount(0);
          setWeeklyData([]);
          return;
        }

        const today = new Date().toISOString().split("T")[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [
          { data: clientsRes },
          { data: employeesRes },
          { data: appointmentsRes },
          { data: servicesRes },
          { data: salesToday },
          { data: recent },
          { data: products },
          { data: weekSales },
        ] = await Promise.all([
          supabase.from("salon_customers").select("id, first_name, last_name, email, phone, total_spent, visit_count, last_visit").eq("is_active", true).eq("branch_id", activeBranchId),
          supabase.from("salon_employees").select("id, first_name, last_name, role").eq("is_active", true).eq("branch_id", activeBranchId),
          supabase.from("salon_appointments").select("id, customer_id, employee_id, service_id, appointment_date, appointment_time, duration_minutes, status").eq("branch_id", activeBranchId).order("appointment_date", { ascending: false }).limit(100),
          supabase.from("salon_services").select("id, name").eq("is_active", true).eq("branch_id", activeBranchId),
          supabase.from("salon_sales").select("total_amount").eq("branch_id", activeBranchId).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`),
          supabase.from("salon_sales").select("id, total_amount, payment_method, created_at").eq("branch_id", activeBranchId).order("created_at", { ascending: false }).limit(10),
          supabase.from("salon_products").select("id, quantity_in_stock, reorder_level").eq("branch_id", activeBranchId).eq("is_active", true),
          supabase.from("salon_sales").select("total_amount, created_at").eq("branch_id", activeBranchId).gte("created_at", `${weekAgo.toISOString().split("T")[0]}T00:00:00`).lte("created_at", `${today}T23:59:59`),
        ]);

        setClients((clientsRes || []).map((client: any) => ({
          ...client,
          name: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
        })));
        setEmployees((employeesRes || []).map((employee: any) => ({
          ...employee,
          name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
        })));
        setAppointments((appointmentsRes || []).map((appointment: any) => ({
          ...appointment,
          date: appointment.appointment_date,
          startHour: appointment.appointment_time ? Number(appointment.appointment_time.slice(0, 2)) + Number(appointment.appointment_time.slice(3, 5)) / 60 : 9,
          duration: appointment.duration_minutes ? Number(appointment.duration_minutes) / 60 : 0.5,
        })));
        setServices(servicesRes || []);

        if (salesToday) {
          setTodayRevenue(salesToday.reduce((sum: number, sale: any) => sum + Number(sale.total_amount || 0), 0));
        }
        if (recent) setRecentSales(recent);
        if (products) setLowStockCount(products.filter((product: any) => Number(product.quantity_in_stock || 0) <= Number(product.reorder_level || 0)).length);

        if (weekSales) {
          const dayMap = new Map<string, { revenue: number; appointments: number }>();
          const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dayMap.set(d.toISOString().split("T")[0], { revenue: 0, appointments: 0 });
          }
          weekSales.forEach((sale: any) => {
            const day = sale.created_at.split("T")[0];
            if (dayMap.has(day)) {
              dayMap.get(day)!.revenue += Number(sale.total_amount || 0);
            }
          });
          appointmentsRes?.forEach((appointment: any) => {
            const day = appointment.appointment_date;
            if (dayMap.has(day)) {
              dayMap.get(day)!.appointments += 1;
            }
          });
          setWeeklyData(Array.from(dayMap.entries()).map(([date, data], i) => ({
            day: days[i] || date.slice(5),
            ...data,
          })));
        }
      } catch (err) {
        console.error("Dashboard data error:", err);
      } finally {
        setDashboardLoading(false);
      }
    };

    void loadDashboardData();

    const handleUpdate = () => {
      if (!isAuthenticated) setActiveBiz(glowupStore.getActiveBusiness());
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, [activeBranchId, isAuthenticated]);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayApts = appointments.filter((a: any) => a.date === todayStr);
  const totalSpent = clients.reduce((sum: number, c: any) => {
    const rawString = String(c.totalSpent || c.total_spent || '0').replace(/[^\d.-]/g, '');
    return sum + (isNaN(parseFloat(rawString)) ? 0 : parseFloat(rawString));
  }, 0);

  let avgDuration = "45min";
  if (appointments.length > 0) {
    const avgHrs = appointments.reduce((sum: number, a: any) => sum + (a.duration || 1), 0) / appointments.length;
    avgDuration = `${Math.round(avgHrs * 60)}min`;
  }

  const stats: DashboardStat[] = [
    {
      title: "Ventes du jour", value: format(todayRevenue),
      icon: <DollarSign className="h-5 w-5" />, color: "success",
      trend: { value: 12, isPositive: true },
    },
    {
      title: "RDV aujourd'hui", value: todayApts.length.toString(),
      icon: <Calendar className="h-5 w-5" />, color: "info",
    },
    {
      title: "Clients", value: clients.length.toString(),
      icon: <Users className="h-5 w-5" />, color: "primary",
      trend: { value: 8, isPositive: true },
    },
    {
      title: "Stock faible", value: lowStockCount.toString(),
      icon: <Package className="h-5 w-5" />, color: lowStockCount > 0 ? "warning" : "success",
    },
  ];

  const formattedAppointments = todayApts
    .map((apt: any) => {
      const emp = employees.find((e: any) => e.id === (apt.employeeId || apt.employee_id));
      const startH = apt.startHour || 9;
      const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
      let status = "upcoming";
      if (currentHour >= startH + (apt.duration || 1)) status = "done";
      else if (currentHour >= startH) status = "in_progress";
      const minutes = Math.round((apt.duration || 1) * 60);
      const durStr = minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? minutes % 60 : ""}` : `${minutes}min`;
      const hrs = Math.floor(startH);
      const mins = Math.round((startH - hrs) * 60);
      return {
        client: apt.clientName || apt.client_id || "Client",
        service: apt.serviceName || apt.service_id || "Service",
        time: `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`,
        duration: durStr,
        employee: emp ? (emp.name || `${emp.first_name || ""} ${emp.last_name || ""}`) : "—",
        status,
      };
    })
    .sort((a: any, b: any) => a.time.localeCompare(b.time));

  if (isDataLoading) {
    return (
      <DashboardLayout role="salon_admin" title="Dashboard" subtitle="Chargement...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (isBranchInitialising || (isAuthenticated && !activeBranchId)) {
    return (
      <DashboardLayout role="salon_admin" title="Dashboard" subtitle="Initialisation du salon...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-xl w-full rounded-2xl border border-border bg-card/95 p-8 text-center shadow-elevated">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Votre branche principale est en cours de préparation</h2>
            <p className="text-muted-foreground">
              Nous créons automatiquement la branche par défaut de ce nouveau salon. Les clients, le stock, le POS et les rendez-vous seront disponibles dès que l’initialisation sera terminée.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="salon_admin"
      title="Dashboard Salon"
      subtitle="Vue d'ensemble de votre activité"
    >
      <StaggerContainer className="space-y-6">
        {subscriptionReminder.shouldPrompt && (
          <StaggerItem>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{subscriptionReminder.title}</p>
                    <p className="text-sm text-muted-foreground">{subscriptionReminder.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {subscriptionReminder.planName ? `${subscriptionReminder.planName} • ` : ""}
                      {subscriptionReminder.businessName}
                    </p>
                  </div>
                </div>
                <Button asChild disabled={!subscriptionReminder.paymentUrl}>
                  <Link to={subscriptionReminder.paymentUrl || "#"}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {subscriptionReminder.ctaLabel}
                  </Link>
                </Button>
              </div>
            </div>
          </StaggerItem>
        )}

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-xl border border-border/50 p-5 hover:shadow-soft transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                    <p className="text-2xl font-bold font-display">{stat.value}</p>
                    {stat.trend && (
                      <p className={cn("text-xs font-medium flex items-center gap-1", stat.trend.isPositive ? "text-success" : "text-destructive")}>
                        <span>{stat.trend.isPositive ? "↑" : "↓"}</span>
                        <span>{Math.abs(stat.trend.value)}% vs mois dernier</span>
                      </p>
                    )}
                  </div>
                  <div className={cn(
                    "p-3 rounded-lg",
                    stat.color === "success" ? "bg-success/10 text-success" :
                    stat.color === "info" ? "bg-info/10 text-info" :
                    stat.color === "warning" ? "bg-warning/10 text-warning" :
                    "bg-primary/10 text-primary"
                  )}>
                    {stat.icon}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Revenus des 7 derniers jours
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {weeklyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Revenus" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Aucune donnée cette semaine
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> RDV par jour
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {weeklyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="appointments" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="RDV" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Aucune donnée cette semaine
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card rounded-xl border border-border">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h3 className="font-semibold text-sm">Rendez-vous du jour</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <Link to="/salon/appointments">
                  <Button size="sm" variant="outline" className="gap-1">
                    Voir tout <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              <div className="divide-y divide-border">
                {formattedAppointments.map((apt: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                    <div className="text-center min-w-[55px]">
                      <p className="font-bold text-sm">{apt.time}</p>
                      <p className="text-[10px] text-muted-foreground">{apt.duration}</p>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {apt.client.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{apt.client}</p>
                        <p className="text-xs text-muted-foreground truncate">{apt.service}</p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">{apt.employee}</p>
                    </div>
                    <Badge variant={
                      apt.status === "done" ? "secondary" :
                      apt.status === "in_progress" ? "default" : "outline"
                    } className="text-xs">
                      {apt.status === "done" ? "Terminé" :
                       apt.status === "in_progress" ? "En cours" : "Planifié"}
                    </Badge>
                  </div>
                ))}
                {formattedAppointments.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Aucun rendez-vous aujourd'hui
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold text-sm mb-3">Actions rapides</h3>
                <div className="space-y-2">
                  <Link to="/salon/appointments">
                    <Button variant="outline" className="w-full justify-start gap-2 h-10">
                      <Calendar className="h-4 w-4" /> Nouveau rendez-vous
                    </Button>
                  </Link>
                  <Link to="/salon/pos">
                    <Button variant="outline" className="w-full justify-start gap-2 h-10">
                      <ShoppingBag className="h-4 w-4" /> Nouvelle vente POS
                    </Button>
                  </Link>
                  <Link to="/salon/clients">
                    <Button variant="outline" className="w-full justify-start gap-2 h-10">
                      <Users className="h-4 w-4" /> Nouveau client
                    </Button>
                  </Link>
                  <Link to="/salon/products">
                    <Button variant="outline" className="w-full justify-start gap-2 h-10">
                      <Package className="h-4 w-4" /> Ajouter produit
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold text-sm mb-3">Dernières ventes</h3>
                <div className="space-y-2">
                  {recentSales.slice(0, 5).map((sale: any, i: number) => (
                    <div key={sale.id || i} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        {sale.payment_method === "cash" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-info" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(sale.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span className="font-medium text-sm">{format(sale.total_amount)}</span>
                    </div>
                  ))}
                  {recentSales.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Aucune vente aujourd'hui</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
