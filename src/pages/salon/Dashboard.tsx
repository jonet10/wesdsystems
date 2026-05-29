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
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
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
  const { isAuthenticated } = useAuth();
  const { formatCompact, format } = useCurrency();
  const [activeBiz, setActiveBiz] = useState(glowupStore.getActiveBusiness());
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; revenue: number; appointments: number }[]>([]);

  const { data: clientsDb, isLoading: clientsLoading } = useSupabaseQuery<any>(['clients'], 'clients', '*', { enabled: isAuthenticated });
  const { data: employeesDb, isLoading: empLoading } = useSupabaseQuery<any>(['employees'], 'employees', '*', { enabled: isAuthenticated });
  const { data: appointmentsDb, isLoading: aptLoading } = useSupabaseQuery<any>(['transactions'], 'transactions', '*', { enabled: isAuthenticated });
  const { data: servicesDb, isLoading: servLoading } = useSupabaseQuery<any>(['services'], 'services', '*', { enabled: isAuthenticated });

  const clients = useMemo(() => {
    if (clientsDb && clientsDb.length > 0) return clientsDb;
    return glowupStore.getClients();
  }, [clientsDb]);

  const employees = useMemo(() => {
    return (employeesDb && employeesDb.length > 0) ? employeesDb : glowupStore.getEmployees();
  }, [employeesDb]);

  const appointments = useMemo(() => {
    if (appointmentsDb && appointmentsDb.length > 0) {
      return appointmentsDb.map((a: any) => ({
        ...a,
        date: a.scheduled_at ? a.scheduled_at.split("T")[0] : new Date().toISOString().split("T")[0],
        duration: a.amount ? 1 : 0.5,
      }));
    }
    return glowupStore.getAppointments();
  }, [appointmentsDb]);

  const services = useMemo(() => {
    return (servicesDb && servicesDb.length > 0) ? servicesDb : glowupStore.getServices();
  }, [servicesDb]);

  const isDataLoading = isAuthenticated && (clientsLoading || empLoading || aptLoading || servLoading);

  useEffect(() => {
    if (isDataLoading) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const todayApts = appointments.filter((a: any) => a.date === todayStr);

    loadDashboardData();

    const handleUpdate = () => {
      if (!isAuthenticated) setActiveBiz(glowupStore.getActiveBusiness());
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, [clients, employees, appointments, services, isDataLoading, isAuthenticated]);

  const loadDashboardData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [{ data: salesToday }, { data: recent }, { data: products }, { data: weekSales }] = await Promise.all([
        supabase.from("salon_sales")
          .select("total_amount")
          .gte("created_at", `${today}T00:00:00`)
          .lte("created_at", `${today}T23:59:59`),
        supabase.from("salon_sales")
          .select("id, total_amount, payment_method, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("salon_products")
          .select("id, quantity_in_stock, reorder_level")
          .eq("is_active", true),
        supabase.from("salon_sales")
          .select("total_amount, created_at")
          .gte("created_at", `${weekAgo.toISOString().split("T")[0]}T00:00:00`)
          .lte("created_at", `${today}T23:59:59`),
      ]);

      if (salesToday) {
        setTodayRevenue(salesToday.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0));
      }
      if (recent) setRecentSales(recent);
      if (products) setLowStockCount(products.filter((p: any) => p.quantity_in_stock <= p.reorder_level).length);

      if (weekSales) {
        const dayMap = new Map<string, { revenue: number; appointments: number }>();
        const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dayMap.set(d.toISOString().split("T")[0], { revenue: 0, appointments: 0 });
        }
        weekSales.forEach((s: any) => {
          const day = s.created_at.split("T")[0];
          if (dayMap.has(day)) {
            const entry = dayMap.get(day)!;
            entry.revenue += Number(s.total_amount || 0);
          }
        });
        const todayApts = appointments.filter((a: any) => {
          const aptDate = a.date;
          return dayMap.has(aptDate);
        });
        todayApts.forEach((a: any) => {
          if (dayMap.has(a.date)) {
            dayMap.get(a.date)!.appointments += 1;
          }
        });
        const chartData = Array.from(dayMap.entries()).map(([date, data], i) => ({
          day: days[i] || date.slice(5),
          ...data,
        }));
        setWeeklyData(chartData);
      }
    } catch (err) {
      console.error("Dashboard data error:", err);
    }
  };

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

  return (
    <DashboardLayout
      role="salon_admin"
      title="Dashboard Salon"
      subtitle="Vue d'ensemble de votre activité"
    >
      <StaggerContainer className="space-y-6">
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
