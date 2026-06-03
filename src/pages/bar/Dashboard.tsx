import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Beer, Package, DollarSign, TrendingUp, AlertCircle, ShoppingBag, ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  DEFAULT_PLATFORM_TIME_ZONE,
  getDateKeyInTimeZone,
  getDayRangeInTimeZone,
  getWeekdayLabelInTimeZone,
  shiftDateKey,
} from "@/lib/timezone-date";

interface DashboardStat {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color?: string;
}

export default function BarDashboard() {
  const { isAuthenticated } = useAuth();
  const { format } = useCurrency();
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; revenue: number }[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadDashboardData();
  }, [isAuthenticated]);

  const loadDashboardData = async () => {
    setDashboardLoading(true);
    try {
      const timeZone = DEFAULT_PLATFORM_TIME_ZONE;
      const today = getDateKeyInTimeZone(new Date(), timeZone);
      const weekStart = shiftDateKey(today, -6);
      const todayRange = getDayRangeInTimeZone(today, timeZone);
      const weekRange = getDayRangeInTimeZone(weekStart, timeZone);

      const [
        { data: salesToday }, 
        { data: products }, 
        { data: weekSales }
      ] = await Promise.all([
        supabase.from("bar_sales")
          .select("id, total, payment_method, created_at")
          .gte("created_at", todayRange.start)
          .lte("created_at", todayRange.end),
        supabase.from("bar_products")
          .select("id, stock_cases, stock_units, critical_stock_level")
          .eq("is_active", true),
        supabase.from("bar_sales")
          .select("total, created_at")
          .gte("created_at", weekRange.start)
          .lte("created_at", todayRange.end),
      ]);

      if (salesToday) {
        setTodaySales(salesToday);
        setTodayRevenue(salesToday.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0));
      }

      if (products) {
        setLowStockCount(products.filter((p: any) => (p.stock_cases * 24 + p.stock_units) <= p.critical_stock_level).length);
      }

      if (weekSales) {
        const dayMap = new Map<string, { revenue: number }>();
        const dateKeys = Array.from({ length: 7 }, (_, index) => shiftDateKey(weekStart, index));
        for (const dateKey of dateKeys) {
          dayMap.set(dateKey, { revenue: 0 });
        }
        weekSales.forEach((s: any) => {
          const day = getDateKeyInTimeZone(new Date(s.created_at), timeZone);
          if (dayMap.has(day)) {
            const entry = dayMap.get(day)!;
            entry.revenue += Number(s.total || 0);
          }
        });
        
        const chartData = Array.from(dayMap.entries()).map(([date, data]) => ({
          day: getWeekdayLabelInTimeZone(new Date(`${date}T12:00:00Z`), timeZone),
          ...data,
        }));
        setWeeklyData(chartData);
      }
    } catch (err) {
      console.error("Dashboard data error:", err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const stats: DashboardStat[] = [
    {
      title: "Chiffre d'affaires", value: format(todayRevenue),
      icon: <DollarSign className="h-5 w-5" />, color: "success",
      trend: { value: 12, isPositive: true },
    },
    {
      title: "Ventes du jour", value: todaySales.length.toString(),
      icon: <ShoppingBag className="h-5 w-5" />, color: "info",
    },
    {
      title: "Produits en rupture", value: lowStockCount.toString(),
      icon: <AlertCircle className="h-5 w-5" />, color: lowStockCount > 0 ? "destructive" : "success",
    },
    {
      title: "Total Produits", value: "24", // Placeholder pour l'instant
      icon: <Package className="h-5 w-5" />, color: "primary",
    },
  ];

  if (dashboardLoading) {
    return (
      <DashboardLayout role="salon_admin" title="Dashboard Bar" subtitle="Chargement...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="salon_admin"
      title="Dashboard Bar & Restaurant"
      subtitle="Vue d'ensemble de l'activité du bar"
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
                    stat.color === "destructive" ? "bg-destructive/10 text-destructive" :
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
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

            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold text-sm mb-3">Actions rapides</h3>
                <div className="space-y-2">
                  <Link to="/bar/pos">
                    <Button variant="outline" className="w-full justify-start gap-2 h-10">
                      <ShoppingBag className="h-4 w-4" /> Ouvrir la Caisse (POS)
                    </Button>
                  </Link>
                  <Link to="/bar/inventory">
                    <Button variant="outline" className="w-full justify-start gap-2 h-10">
                      <Package className="h-4 w-4" /> Gérer l'inventaire
                    </Button>
                  </Link>
                  <Link to="/bar/cocktails">
                    <Button variant="outline" className="w-full justify-start gap-2 h-10">
                      <Beer className="h-4 w-4" /> Gérer les cocktails
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Dernières ventes</h3>
                  <Link to="/bar/pos" className="text-xs text-primary hover:underline">
                    Voir tout
                  </Link>
                </div>
                <div className="space-y-3">
                  {todaySales.slice(0, 5).map((sale: any, i: number) => (
                    <div key={sale.id || i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {sale.payment_method}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(sale.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_PLATFORM_TIME_ZONE })}
                        </span>
                      </div>
                      <span className="font-medium text-sm">{format(sale.total)}</span>
                    </div>
                  ))}
                  {todaySales.length === 0 && (
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
