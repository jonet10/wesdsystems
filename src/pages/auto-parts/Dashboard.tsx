import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/modules/auto-parts/components/KpiCard";
import { salesSummary, weeklyTrend, clientSummary, getDateRangePreset } from "@/modules/auto-parts/services/reportsService";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Package, DollarSign, AlertTriangle, TrendingUp, ShoppingCart, Truck, Receipt, Users, Clock, BarChart3 } from "lucide-react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import type { SalesSummary as SalesSummaryType, WeeklyTrend, ClientSummary } from "@/modules/auto-parts/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function AutoPartsDashboardPage() {
  const businessId = useAutoPartsBusinessId();
  const { format } = useCurrency();
  const { hasAutoPartsPermission } = useAuth();
  const canViewStockValue = hasAutoPartsPermission(PERMISSIONS.STOCK_MANAGE);
  const canViewPurchases = hasAutoPartsPermission(PERMISSIONS.PURCHASES_MANAGE);
  const canViewReports = hasAutoPartsPermission(PERMISSIONS.REPORTS_VIEW);
  const canViewProfit = canViewReports && hasAutoPartsPermission(PERMISSIONS.PRODUCTS_MANAGE);

  const [stats, setStats] = useState({ totalProducts: 0, totalStockValue: 0, outOfStock: 0, lowStock: 0, monthPurchases: 0 });
  const [todaySummary, setTodaySummary] = useState<SalesSummaryType | null>(null);
  const [weekSummary, setWeekSummary] = useState<SalesSummaryType | null>(null);
  const [monthSummary, setMonthSummary] = useState<SalesSummaryType | null>(null);
  const [trend, setTrend] = useState<WeeklyTrend[]>([]);
  const [clientInfo, setClientInfo] = useState<ClientSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }

    const loadData = async () => {
      const month = getDateRangePreset("month");
      const safeCall = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn(); } catch (e) { console.warn("Dashboard RPC failed:", (e as any)?.message ?? e); return fallback; }
      };

      const [counts, today, week, mnth, wkTrend, clients] = await Promise.all([
        safeCall(() => supabase.rpc("auto_parts_dashboard_counts", { p_business_id: businessId }).then(r => r.data), null),
        safeCall(() => salesSummary(businessId, getDateRangePreset("today").start, new Date().toISOString()), null),
        safeCall(() => salesSummary(businessId, getDateRangePreset("week").start, new Date().toISOString()), null),
        safeCall(() => salesSummary(businessId, month.start, month.end), null),
        safeCall(() => weeklyTrend(businessId, 12), []),
        safeCall(() => clientSummary(businessId), null),
      ]);

      if (counts) setStats(counts);
      if (today) setTodaySummary(today);
      if (week) setWeekSummary(week);
      if (mnth) setMonthSummary(mnth);
      if (wkTrend) setTrend(wkTrend);
      if (clients) setClientInfo(clients);
      setLoading(false);
    };

    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [businessId]);

  const trendChart = useMemo(() => ({
    labels: trend.map((w) => {
      const d = new Date(w.week_start + "T00:00:00");
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }),
    datasets: [
      {
        label: "Ventes",
        data: trend.map((w) => w.total_sales),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  }), [trend]);

  if (loading) return <DashboardLayout role="salon_admin" title="Auto Parts"><p className="text-muted-foreground p-8">Chargement...</p></DashboardLayout>;

  return (
    <DashboardLayout role="salon_admin" title="Auto Parts" subtitle="Tableau de bord exécutif">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={<Package className="h-5 w-5" />} label="Total pièces" value={stats.totalProducts} color="text-blue-500" />
            {canViewStockValue && (
              <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Valeur stock" value={format(stats.totalStockValue)} color="text-green-500" />
            )}
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="En rupture" value={stats.outOfStock} color="text-red-500" />
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Stock faible" value={stats.lowStock} color="text-amber-500" />
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Ventes aujourd'hui"
              value={format(todaySummary?.current.total_revenue ?? 0)}
              trend={todaySummary?.evolution.revenue_pct}
              trendLabel="vs hier"
              color="text-indigo-500"
            />
            <KpiCard
              icon={<ShoppingCart className="h-5 w-5" />}
              label="Ventes semaine"
              value={format(weekSummary?.current.total_revenue ?? 0)}
              trend={weekSummary?.evolution.revenue_pct}
              trendLabel="vs sem. dernière"
              color="text-emerald-500"
            />
            <KpiCard
              icon={<BarChart3 className="h-5 w-5" />}
              label="Ventes mois"
              value={format(monthSummary?.current.total_revenue ?? 0)}
              trend={monthSummary?.evolution.revenue_pct}
              trendLabel="vs mois dernier"
              color="text-violet-500"
            />
            <KpiCard
              icon={<Receipt className="h-5 w-5" />}
              label="Factures mois"
              value={clientInfo?.invoices_month ?? 0}
              trend={monthSummary?.evolution.orders_pct}
              trendLabel="vs mois dernier"
              color="text-cyan-500"
            />
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={<Users className="h-5 w-5" />} label="Clients" value={clientInfo?.total_clients ?? 0} color="text-pink-500" />
            <KpiCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Panier moyen"
              value={format(monthSummary?.current.avg_order_value ?? 0)}
              trend={monthSummary?.evolution.avg_value_pct}
              trendLabel="vs mois dernier"
              color="text-orange-500"
            />
            {canViewPurchases && (
              <KpiCard icon={<Truck className="h-5 w-5" />} label="Achats mois" value={stats.monthPurchases} color="text-purple-500" />
            )}
            <KpiCard icon={<Clock className="h-5 w-5" />} label="Moy. journalier" value={format(monthSummary?.current.daily_avg ?? 0)} color="text-teal-500" />
          </div>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardHeader><CardTitle className="text-base">Tendance des ventes (12 semaines)</CardTitle></CardHeader>
            <CardContent>
              <Line
                data={trendChart}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { callback: (v) => `${Number(v).toLocaleString()} HTG` } } },
                }}
              />
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
