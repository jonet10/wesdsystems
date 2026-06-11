import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, DollarSign, AlertTriangle, TrendingUp, ShoppingCart, Truck, Receipt } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

export default function AutoPartsDashboardPage() {
  const businessId = useAutoPartsBusinessId();
  const { hasAutoPartsPermission, autoPartsStaffSession } = useAuth();
  const staffId = autoPartsStaffSession?.role === "cashier" ? autoPartsStaffSession.id : undefined;
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStockValue: 0,
    outOfStock: 0,
    lowStock: 0,
    todaySales: 0,
    monthSales: 0,
    monthPurchases: 0,
    pendingOrders: 0,
  });
  const [monthlySales, setMonthlySales] = useState<number[]>(Array(12).fill(0));
  const [categoryRepartition, setCategoryRepartition] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!businessId) { setLoading(false); return; }

      const rpcParams = staffId ? { p_business_id: businessId, p_staff_id: staffId } : { p_business_id: businessId };
      const [{ data: counts }, { data: monthSalesData }, { data: catData }] = await Promise.all([
        supabase.rpc("auto_parts_dashboard_counts", rpcParams),
        supabase.rpc("auto_parts_monthly_sales", rpcParams),
        supabase.rpc("auto_parts_category_repartition", { p_business_id: businessId }),
      ]);
      if (counts) setStats(counts);

      const byMonth = Array(12).fill(0);
      (monthSalesData || []).forEach((s: any) => {
        byMonth[s.month] = Number(s.total);
      });
      setMonthlySales(byMonth);
      if (catData) setCategoryRepartition(catData);
      setLoading(false);
    };
    load();
  }, [businessId, staffId]);

  if (loading) return <DashboardLayout role="salon_admin" title="Auto Parts"><p className="text-muted-foreground p-8">Chargement...</p></DashboardLayout>;

  const canViewStockValue = hasAutoPartsPermission(PERMISSIONS.STOCK_MANAGE);
  const canViewPurchases = hasAutoPartsPermission(PERMISSIONS.PURCHASES_MANAGE);
  const hiddenLabels = new Set<string>();
  if (!canViewStockValue) hiddenLabels.add("Valeur stock");
  if (!canViewPurchases) { hiddenLabels.add("Achats du mois"); hiddenLabels.add("Commandes en attente"); }
  const allMetrics = [
    { icon: Package, label: "Total pièces", value: stats.totalProducts, color: "text-blue-500" },
    { icon: DollarSign, label: "Valeur stock", value: `${stats.totalStockValue.toLocaleString()} HTG`, color: "text-green-500" },
    { icon: AlertTriangle, label: "En rupture", value: stats.outOfStock, color: "text-red-500" },
    { icon: AlertTriangle, label: "Stock faible", value: stats.lowStock, color: "text-amber-500" },
    { icon: TrendingUp, label: "Ventes aujourd'hui", value: `${stats.todaySales.toLocaleString()} HTG`, color: "text-indigo-500" },
    { icon: ShoppingCart, label: "Ventes du mois", value: `${stats.monthSales.toLocaleString()} HTG`, color: "text-emerald-500" },
    { icon: Truck, label: "Achats du mois", value: `${stats.monthPurchases}`, color: "text-purple-500" },
    { icon: Receipt, label: "Commandes en attente", value: stats.pendingOrders, color: "text-orange-500" },
  ];
  const metrics = allMetrics.filter(m => !hiddenLabels.has(m.label));

  return (
    <DashboardLayout role="salon_admin" title="Auto Parts" subtitle="Tableau de bord">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <Card key={m.label}>
                <CardHeader className="pb-2 flex-row items-center gap-2">
                  <m.icon className={`h-5 w-5 ${m.color}`} />
                  <CardTitle className="text-sm text-muted-foreground">{m.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold font-display">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </StaggerItem>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StaggerItem>
            <Card>
              <CardHeader><CardTitle className="text-base">Ventes mensuelles</CardTitle></CardHeader>
              <CardContent>
                <Bar
                  data={{
                    labels: ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"],
                    datasets: [{ label: "Ventes (HTG)", data: monthlySales, backgroundColor: "rgba(59,130,246,0.6)" }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader><CardTitle className="text-base">Répartition par catégorie</CardTitle></CardHeader>
              <CardContent>
                <Doughnut
                  data={{
                    labels: categoryRepartition.map((c) => c.name),
                    datasets: [{
                      data: categoryRepartition.map((c) => c.count),
                      backgroundColor: [
                        "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
                        "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
                      ],
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } }}
                />
              </CardContent>
            </Card>
          </StaggerItem>
        </div>
      </StaggerContainer>
    </DashboardLayout>
  );
}
