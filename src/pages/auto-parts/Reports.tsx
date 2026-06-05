import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listAlerts } from "@/modules/auto-parts/services/alerts";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { AlertTriangle, TrendingUp, DollarSign, Package, Truck } from "lucide-react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import type { AutoPartsAlert } from "@/modules/auto-parts/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

export default function AutoPartsReportsPage() {
  const businessId = useAutoPartsBusinessId();
  const { format } = useCurrency();
  const [alerts, setAlerts] = useState<AutoPartsAlert[]>([]);
  const [monthlySales, setMonthlySales] = useState<number[]>(Array(12).fill(0));
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);
  const [categorySales, setCategorySales] = useState<{ name: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bFilter = (q: any) => businessId ? q.or(`business_id.eq.${businessId},business_id.is.null`) : q;
    (async () => {
      try {
        setAlerts(await listAlerts(businessId));

        // Monthly sales
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
        const { data: yearSales } = await bFilter(
          supabase.from("auto_parts_sales").select("total, created_at")
        ).gte("created_at", yearStart);
        const byMonth = Array(12).fill(0);
        (yearSales || []).forEach((s: any) => { byMonth[new Date(s.created_at).getMonth()] += Number(s.total); });
        setMonthlySales(byMonth);

        // Top products
        const { data: topItems } = await bFilter(
          supabase.from("auto_parts_sale_items").select("product_name, sum:quantity")
        ).order("sum", { ascending: false, nullsFirst: false }).limit(10);
        if (topItems) setTopProducts(topItems.map((t: any) => ({ name: t.product_name, qty: Number(t.sum) })));

        // Category sales via products
        const { data: catSales } = await bFilter(
          supabase.from("auto_parts_sale_items").select("product_name, total_price, product:product_id(category:category_id(name))")
        ).limit(1000);
        if (catSales) {
          const catMap = new Map<string, number>();
          catSales.forEach((s: any) => {
            const cat = s.product?.category?.name || "Sans catégorie";
            catMap.set(cat, (catMap.get(cat) || 0) + Number(s.total_price));
          });
          setCategorySales(Array.from(catMap.entries()).map(([name, total]) => ({ name, total })));
        }
      } catch (e: any) { console.error(e); } finally { setLoading(false); }
    })();
  }, [businessId]);

  const unreadAlerts = alerts.filter((a) => !a.read);

  return (
    <DashboardLayout role="salon_admin" title="Rapports" subtitle="Analyses et indicateurs">
      <StaggerContainer>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2 flex-row items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><CardTitle className="text-sm text-muted-foreground">Alertes non lues</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{unreadAlerts.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex-row items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-500" /><CardTitle className="text-sm text-muted-foreground">Ventes annuelles</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{format(monthlySales.reduce((a, b) => a + b, 0))}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Ventes</TabsTrigger>
            <TabsTrigger value="products">Top produits</TabsTrigger>
            <TabsTrigger value="alerts">Alertes</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-4 space-y-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Ventes par catégorie</CardTitle></CardHeader>
                <CardContent>
                  <Doughnut
                    data={{
                      labels: categorySales.map((c) => c.name),
                      datasets: [{ data: categorySales.map((c) => c.total), backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"] }],
                    }}
                    options={{ responsive: true, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } }}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 produits les plus vendus</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Produit</th><th className="py-2">Quantité</th></tr></thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2 font-medium">{p.qty}</td>
                      </tr>
                    ))}
                    {topProducts.length === 0 && <tr><td colSpan={2} className="py-8 text-center text-muted-foreground">Aucune vente</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Alertes stock</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <div key={a.id} className={`p-3 rounded-lg border ${a.read ? "opacity-60" : ""}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant={a.type === "out_of_stock" ? "destructive" : a.type === "low_stock" ? "secondary" : "default"}>
                          {a.type === "low_stock" ? "Stock faible" : a.type === "out_of_stock" ? "Rupture" : a.type}
                        </Badge>
                        <span className="text-sm">{a.message}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString("fr-FR")}</p>
                    </div>
                  ))}
                  {alerts.length === 0 && <p className="text-center text-muted-foreground py-8">Aucune alerte</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </StaggerContainer>
    </DashboardLayout>
  );
}
