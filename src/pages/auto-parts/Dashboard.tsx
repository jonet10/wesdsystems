import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
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
    const bFilter = (q: any) => businessId ? q.or(`business_id.eq.${businessId},business_id.is.null`) : q;
    const load = async () => {
      const [{ count: totalProducts }, { data: products }, { count: outOfStock }, { count: lowStock }] = await Promise.all([
        bFilter(supabase.from("auto_parts_products").select("*", { count: "exact", head: true })),
        bFilter(supabase.from("auto_parts_products").select("unit_price, cost_price, stock_quantity, category:category_id(name)")),
        bFilter(supabase.from("auto_parts_products").select("*", { count: "exact", head: true }).eq("active", true).lte("stock_quantity", 0)),
        bFilter(supabase.from("auto_parts_products").select("*", { count: "exact", head: true }).eq("active", true).gt("stock_quantity", 0).lte("stock_quantity", "min_stock")),
      ]);

      const totalStockValue = (products || []).reduce((sum, p) => sum + Number(p.cost_price) * Number(p.stock_quantity || 0), 0);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [{ count: todaySales }, { data: monthSalesData }] = await Promise.all([
        bFilter(supabase.from("auto_parts_sales").select("*", { count: "exact", head: true })).gte("created_at", dayStart),
        bFilter(supabase.from("auto_parts_sales").select("total, created_at")).gte("created_at", monthStart),
      ]);

      const monthSales = (monthSalesData || []).reduce((sum, s) => sum + Number(s.total), 0);

      const [{ count: monthPurchases }] = await Promise.all([
        bFilter(supabase.from("auto_parts_purchases").select("*", { count: "exact", head: true })).gte("created_at", monthStart).eq("status", "delivered"),
      ]);

      const [{ count: pendingOrders }] = await Promise.all([
        bFilter(supabase.from("auto_parts_purchases").select("*", { count: "exact", head: true })).in("status", ["pending", "confirmed"]),
      ]);

      setStats({
        totalProducts: totalProducts || 0,
        totalStockValue,
        outOfStock: outOfStock || 0,
        lowStock: lowStock || 0,
        todaySales: todaySales || 0,
        monthSales,
        monthPurchases: monthPurchases || 0,
        pendingOrders: pendingOrders || 0,
      });

      // Monthly sales for chart
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
      const { data: yearSales } = await bFilter(
        supabase.from("auto_parts_sales").select("total, created_at")
      ).gte("created_at", yearStart);

      const byMonth = Array(12).fill(0);
      (yearSales || []).forEach((s) => {
        const m = new Date(s.created_at).getMonth();
        byMonth[m] += Number(s.total);
      });
      setMonthlySales(byMonth);

      // Category repartition
      const catMap = new Map<string, number>();
      (products || []).forEach((p: any) => {
        const catName = p.category?.name || "Sans catégorie";
        catMap.set(catName, (catMap.get(catName) || 0) + 1);
      });
      setCategoryRepartition(Array.from(catMap.entries()).map(([name, count]) => ({ name, count })));

      setLoading(false);
    };
    load();
  }, [businessId]);

  if (loading) return <DashboardLayout role="salon_admin" title="Auto Parts"><p className="text-muted-foreground p-8">Chargement...</p></DashboardLayout>;

  const metrics = [
    { icon: Package, label: "Total pièces", value: stats.totalProducts, color: "text-blue-500" },
    { icon: DollarSign, label: "Valeur stock", value: `${stats.totalStockValue.toLocaleString()} HTG`, color: "text-green-500" },
    { icon: AlertTriangle, label: "En rupture", value: stats.outOfStock, color: "text-red-500" },
    { icon: AlertTriangle, label: "Stock faible", value: stats.lowStock, color: "text-amber-500" },
    { icon: TrendingUp, label: "Ventes aujourd'hui", value: `${stats.todaySales}`, color: "text-indigo-500" },
    { icon: ShoppingCart, label: "Ventes du mois", value: `${stats.monthSales.toLocaleString()} HTG`, color: "text-emerald-500" },
    { icon: Truck, label: "Achats du mois", value: `${stats.monthPurchases}`, color: "text-purple-500" },
    { icon: Receipt, label: "Commandes en attente", value: stats.pendingOrders, color: "text-orange-500" },
  ];

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
