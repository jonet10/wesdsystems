import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { KpiCard } from "@/modules/auto-parts/components/KpiCard";
import { StoreHealthGauge, HealthDetails } from "@/modules/auto-parts/components/StoreHealthGauge";
import { ExportBar } from "@/modules/auto-parts/components/ExportBar";
import { listAlerts } from "@/modules/auto-parts/services/alerts";
import * as reports from "@/modules/auto-parts/services/reportsService";
import { toast } from "sonner";
import {
  Bar, Doughnut, Line,
} from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import {
  TrendingUp, Package, Truck, Users, Clock, BarChart3, Award, Heart, AlertTriangle,
  ShoppingCart, DollarSign, FileText, Zap, Target,
} from "lucide-react";
import type {
  TopProduct, DormantProduct, StockForecast, BrandAnalysis,
  ProfitSummary, EmployeePerformance, HourlyActivity, StoreHealth,
} from "@/modules/auto-parts/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
];

const DORMANT_PERIODS = [
  { value: 30, label: "30 jours" },
  { value: 60, label: "60 jours" },
  { value: 90, label: "90 jours" },
  { value: 180, label: "180 jours" },
];

const RISK_LABELS: Record<string, string> = {
  rupture: "Rupture", high: "Élevé", medium: "Moyen", low: "Faible", safe: "Sûr", unknown: "Inconnu",
};
const RISK_COLORS: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  rupture: "destructive", high: "destructive", medium: "default", low: "secondary", safe: "outline", unknown: "outline",
};

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export default function AutoPartsReportsPage() {
  const businessId = useAutoPartsBusinessId();
  const { format } = useCurrency();
  const { hasAutoPartsPermission } = useAuth();
  const canViewReports = hasAutoPartsPermission(PERMISSIONS.REPORTS_VIEW);
  const canViewProfit = canViewReports && hasAutoPartsPermission(PERMISSIONS.PRODUCTS_MANAGE);
  const canViewStaff = hasAutoPartsPermission(PERMISSIONS.STAFF_READ);

  const [period, setPeriod] = useState("month");
  const [dormantDays, setDormantDays] = useState(90);

  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dormant, setDormant] = useState<DormantProduct[]>([]);
  const [forecast, setForecast] = useState<StockForecast[]>([]);
  const [brands, setBrands] = useState<BrandAnalysis[]>([]);
  const [profit, setProfit] = useState<ProfitSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeePerformance[]>([]);
  const [heatmap, setHeatmap] = useState<HourlyActivity[]>([]);
  const [health, setHealth] = useState<StoreHealth | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("top-products");

  const reportRef = useRef<HTMLDivElement>(null);

  const safeCall = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch (e) { console.warn("Reports RPC failed:", (e as any)?.message ?? e); return fallback; }
  };

  const loadAll = useCallback(async () => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    const dateRange = reports.getDateRangePreset(period as any);
    const prevStart = new Date(new Date(dateRange.start).getTime() - (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime())).toISOString();

    const [tp, dorm, fc, br, emp, hm, hlth, alrt, prof] = await Promise.all([
      safeCall(() => reports.topProducts(businessId, dateRange.start, dateRange.end, 10, prevStart, dateRange.start), []),
      safeCall(() => reports.dormantProducts(businessId, dormantDays), []),
      safeCall(() => reports.stockForecast(businessId), []),
      safeCall(() => reports.brandAnalysis(businessId, dateRange.start, dateRange.end), []),
      safeCall(() => reports.employeePerformance(businessId, dateRange.start, dateRange.end), []),
      safeCall(() => reports.hourlyActivity(businessId, dateRange.start, dateRange.end), []),
      safeCall(() => reports.storeHealth(businessId), null),
      safeCall(() => listAlerts(businessId), []),
      canViewProfit
        ? safeCall(() => reports.profitSummary(businessId, dateRange.start, dateRange.end), null)
        : Promise.resolve(null),
    ]);

    setTopProducts(tp);
    setDormant(dorm);
    setForecast(fc);
    setBrands(br);
    setEmployees(emp);
    setHeatmap(hm);
    if (hlth) setHealth(hlth);
    setAlerts(alrt);
    if (prof) setProfit(prof);
    setLoading(false);
  }, [businessId, period, dormantDays, canViewProfit]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const topProductsChart = useMemo(() => ({
    labels: topProducts.map((p) => p.product_name.length > 20 ? p.product_name.slice(0, 20) + "..." : p.product_name),
    datasets: [
      { label: "Quantité", data: topProducts.map((p) => p.quantity), backgroundColor: "rgba(59,130,246,0.6)" },
      { label: "CA", data: topProducts.map((p) => p.revenue), backgroundColor: "rgba(16,185,129,0.6)", yAxisID: "y1" },
    ],
  }), [topProducts]);

  const brandChart = useMemo(() => ({
    labels: brands.map((b) => b.brand_name ?? "Sans marque"),
    datasets: [{ data: brands.map((b) => b.revenue), backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"] }],
  }), [brands]);

  const heatmapData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0));
    heatmap.forEach((h) => {
      const col = Math.floor(h.hour / 2);
      if (col < 14) grid[h.day_of_week][col] += h.sale_count;
    });
    const max = Math.max(1, ...grid.flat());
    return { grid, max, labels: Array.from({ length: 14 }, (_, i) => `${String(i * 2).padStart(2, "0")}h`) };
  }, [heatmap]);

  const employeeChart = useMemo(() => ({
    labels: employees.map((e) => e.staff_name),
    datasets: [
      { label: "Ventes", data: employees.map((e) => e.sale_count), backgroundColor: "rgba(59,130,246,0.6)" },
      { label: "CA (HTG)", data: employees.map((e) => e.total_revenue), backgroundColor: "rgba(16,185,129,0.6)", yAxisID: "y1" },
    ],
  }), [employees]);

  const exportHeaders = {
    "top-products": ["Produit", "Quantité", "Chiffre d'affaires", "Qté période préc.", "Évolution qty (%)", "Évolution CA (%)"],
    dormant: ["Produit", "SKU", "Stock", "Valeur stock", "Vente potentielle", "Marge potentielle", "Dernière vente", "Jours sans vente"],
    "stock-forecast": ["Produit", "Stock", "Vente moy./jour", "Jours restants", "Risque"],
    brands: ["Marque", "Ventes", "CA", "%"],
    profit: ["Produit", "Qté", "CA", "Coût", "Profit", "Marge (%)"],
    employees: ["Employé", "Rôle", "Ventes", "CA", "Ticket moyen", "Clients"],
  };

  const exportRows = {
    "top-products": topProducts.map((p) => [p.product_name, p.quantity, p.revenue, p.prev_quantity, p.qty_evolution, p.revenue_evolution]),
    dormant: dormant.map((d) => [d.name, d.sku ?? "-", d.stock_quantity, d.stock_value, d.potential_revenue ?? 0, d.potential_profit ?? 0, d.last_sale_date ?? "Jamais", d.days_since_sale]),
    "stock-forecast": forecast.map((f) => [f.name, f.stock_quantity, f.avg_daily_sales, f.days_until_rupture ?? "N/A", RISK_LABELS[f.risk_level]]),
    brands: brands.map((b) => [b.brand_name ?? "Sans marque", b.sale_count, b.revenue, `${b.percentage}%`]),
    profit: (profit?.top_products ?? []).map((p) => [p.product_name ?? "-", p.qty, p.revenue, p.cost, p.profit, `${p.margin_pct}%`]),
    employees: employees.map((e) => [e.staff_name, e.staff_role, e.sale_count, e.total_revenue, e.avg_ticket, e.client_count]),
  };

  if (loading) return <DashboardLayout role="salon_admin" title="Rapports"><p className="text-muted-foreground p-8">Chargement...</p></DashboardLayout>;

  const content = (
    <div ref={reportRef}>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Période</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <ExportBar filename={`rapport-auto-parts-${period}`} headers={exportHeaders[activeTab as keyof typeof exportHeaders] ?? []} rows={exportRows[activeTab as keyof typeof exportRows] ?? []} printRef={reportRef} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="top-products"><Award className="h-4 w-4 mr-1" />Top produits</TabsTrigger>
          <TabsTrigger value="dormant"><Package className="h-4 w-4 mr-1" />Produits dormants</TabsTrigger>
          <TabsTrigger value="stock-forecast"><Target className="h-4 w-4 mr-1" />Prévisions rupture</TabsTrigger>
          <TabsTrigger value="brands"><BarChart3 className="h-4 w-4 mr-1" />Marques</TabsTrigger>
          {canViewProfit && <TabsTrigger value="profit"><DollarSign className="h-4 w-4 mr-1" />Rentabilité</TabsTrigger>}
          {canViewStaff && <TabsTrigger value="employees"><Users className="h-4 w-4 mr-1" />Employés</TabsTrigger>}
          <TabsTrigger value="heatmap"><Clock className="h-4 w-4 mr-1" />Activité</TabsTrigger>
          <TabsTrigger value="health"><Heart className="h-4 w-4 mr-1" />Santé</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="h-4 w-4 mr-1" />Alertes</TabsTrigger>
        </TabsList>

        {/* ─── TOP PRODUITS ─── */}
        <TabsContent value="top-products" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Top 10 produits les plus vendus</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <Bar
                  data={topProductsChart}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: "top" } },
                    scales: { y: { beginAtZero: true }, y1: { beginAtZero: true, position: "right", grid: { display: false } } },
                  }}
                />
              </div>
              <table className="w-full text-sm mt-4">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Produit</th><th className="py-2 text-right">Qté</th><th className="py-2 text-right">CA</th><th className="py-2 text-right">Évolution</th></tr></thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{p.product_name}</td>
                      <td className="py-2 text-right font-medium">{p.quantity}</td>
                      <td className="py-2 text-right">{format(p.revenue)}</td>
                      <td className="py-2 text-right">
                        {p.revenue_evolution !== null ? (
                          <span className={p.revenue_evolution >= 0 ? "text-emerald-500" : "text-red-500"}>
                            {p.revenue_evolution > 0 ? "+" : ""}{p.revenue_evolution}%
                          </span>
                        ) : <span className="text-muted-foreground">N/A</span>}
                      </td>
                    </tr>
                  ))}
                  {topProducts.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucune donnée</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PRODUITS DORMANTS ─── */}
        <TabsContent value="dormant" className="mt-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-sm">Aucun mouvement depuis</Label>
            <Select value={String(dormantDays)} onValueChange={(v) => setDormantDays(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{DORMANT_PERIODS.map((p) => <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Produits sans mouvement ({dormantDays} jours)</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Produit</th><th className="py-2">Stock</th><th className="py-2">Valeur</th><th className="py-2">Vente potentielle</th><th className="py-2">Marge potentielle</th><th className="py-2">Dernière vente</th><th className="py-2">Jours</th></tr></thead>
                <tbody>
                  {dormant.map((d, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{d.name}</td>
                      <td className="py-2">{d.stock_quantity}</td>
                      <td className="py-2">{format(d.stock_value)}</td>
                      <td className="py-2">{format(d.potential_revenue ?? 0)}</td>
                      <td className="py-2">{format(d.potential_profit ?? 0)}</td>
                      <td className="py-2">{d.last_sale_date ? new Date(d.last_sale_date).toLocaleDateString("fr-FR") : "Jamais"}</td>
                      <td className="py-2"><Badge variant="secondary">{d.days_since_sale} j</Badge></td>
                    </tr>
                  ))}
                  {dormant.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Aucun produit dormant</td></tr>}
                </tbody>
              </table>
              {dormant.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  <p className="text-muted-foreground">
                    Valeur totale immobilisée : <strong>{format(dormant.reduce((s, d) => s + d.stock_value, 0))}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Vente potentielle : <strong>{format(dormant.reduce((s, d) => s + (d.potential_revenue ?? 0), 0))}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Marge potentielle : <strong>{format(dormant.reduce((s, d) => s + (d.potential_profit ?? 0), 0))}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PRÉVISIONS RUPTURE ─── */}
        <TabsContent value="stock-forecast" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Prévisions de rupture de stock</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Produit</th><th className="py-2">Stock</th><th className="py-2">Vente moy./jour</th><th className="py-2">Jours restants</th><th className="py-2">Risque</th></tr></thead>
                <tbody>
                  {forecast.map((f, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{f.name}</td>
                      <td className="py-2">{f.stock_quantity}</td>
                      <td className="py-2">{f.avg_daily_sales}</td>
                      <td className="py-2 font-medium">{f.days_until_rupture !== null ? Math.round(f.days_until_rupture) : "N/A"}</td>
                      <td className="py-2"><Badge variant={RISK_COLORS[f.risk_level] ?? "outline"}>{RISK_LABELS[f.risk_level] ?? f.risk_level}</Badge></td>
                    </tr>
                  ))}
                  {forecast.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Aucun produit à risque</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── MARQUES ─── */}
        <TabsContent value="brands" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Répartition par marque</CardTitle></CardHeader>
              <CardContent className="h-80 flex items-center justify-center">
                {brands.length > 0 ? (
                  <Doughnut data={brandChart} options={{ responsive: true, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } }} />
                ) : <p className="text-muted-foreground">Aucune donnée</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Détail par marque</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Marque</th><th className="py-2 text-right">Ventes</th><th className="py-2 text-right">CA</th><th className="py-2 text-right">%</th></tr></thead>
                  <tbody>
                    {brands.map((b, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{b.brand_name ?? "Sans marque"}</td>
                        <td className="py-2 text-right">{b.sale_count}</td>
                        <td className="py-2 text-right">{format(b.revenue)}</td>
                        <td className="py-2 text-right">{b.percentage}%</td>
                      </tr>
                    ))}
                    {brands.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucune donnée</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── RENTABILITÉ (admin/manager only) ─── */}
        {canViewProfit && (
          <TabsContent value="profit" className="mt-4 space-y-4">
            {profit && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Chiffre d'affaires" value={format(profit.summary.total_revenue)} color="text-blue-500" />
                  <KpiCard icon={<Truck className="h-5 w-5" />} label="Coût total" value={format(profit.summary.total_cost)} color="text-orange-500" />
                  <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Bénéfice" value={format(profit.summary.total_profit)} color="text-emerald-500" />
                  <KpiCard icon={<BarChart3 className="h-5 w-5" />} label="Marge moyenne" value={`${profit.summary.margin_pct}%`} color="text-violet-500" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Top produits rentables</CardTitle></CardHeader>
                    <CardContent className="max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b text-muted-foreground"><th className="py-1 text-left">Produit</th><th className="py-1 text-right">Profit</th><th className="py-1 text-right">Marge</th></tr></thead>
                        <tbody>
                          {profit.top_products.map((p, i) => (
                            <tr key={i} className="border-b"><td className="py-1">{p.product_name}</td><td className="py-1 text-right font-medium">{format(p.profit)}</td><td className="py-1 text-right text-emerald-500">{p.margin_pct}%</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Top catégories rentables</CardTitle></CardHeader>
                    <CardContent className="max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b text-muted-foreground"><th className="py-1 text-left">Catégorie</th><th className="py-1 text-right">Profit</th><th className="py-1 text-right">Marge</th></tr></thead>
                        <tbody>
                          {profit.top_categories.map((c, i) => (
                            <tr key={i} className="border-b"><td className="py-1">{c.category_name}</td><td className="py-1 text-right font-medium">{format(c.profit)}</td><td className="py-1 text-right text-emerald-500">{c.margin_pct}%</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Top fournisseurs rentables</CardTitle></CardHeader>
                    <CardContent className="max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b text-muted-foreground"><th className="py-1 text-left">Fournisseur</th><th className="py-1 text-right">Profit</th><th className="py-1 text-right">Marge</th></tr></thead>
                        <tbody>
                          {profit.top_suppliers.map((s, i) => (
                            <tr key={i} className="border-b"><td className="py-1">{s.supplier_name}</td><td className="py-1 text-right font-medium">{format(s.profit)}</td><td className="py-1 text-right text-emerald-500">{s.margin_pct}%</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        )}

        {/* ─── EMPLOYÉS ─── */}
        {canViewStaff && (
          <TabsContent value="employees" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Performance des employés</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <Bar
                    data={employeeChart}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { position: "top" } },
                      scales: { y: { beginAtZero: true }, y1: { beginAtZero: true, position: "right", grid: { display: false } } },
                      indexAxis: "y",
                    }}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Classement</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Employé</th><th className="py-2 text-right">Ventes</th><th className="py-2 text-right">CA</th><th className="py-2 text-right">Ticket moy.</th></tr></thead>
                    <tbody>
                      {employees.map((e, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2">{e.staff_name}</td>
                          <td className="py-2 text-right">{e.sale_count}</td>
                          <td className="py-2 text-right">{format(e.total_revenue)}</td>
                          <td className="py-2 text-right">{format(e.avg_ticket)}</td>
                        </tr>
                      ))}
                      {employees.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucune donnée</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* ─── HEATMAP ACTIVITÉ ─── */}
        <TabsContent value="heatmap" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Heatmap d'activité (heures × jours)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="grid" style={{ gridTemplateColumns: `80px repeat(${heatmapData.labels.length}, 1fr)`, gap: 2, minWidth: 600 }}>
                  <div />
                  {heatmapData.labels.map((l) => (
                    <div key={l} className="text-[10px] text-muted-foreground text-center">{l}</div>
                  ))}
                  {heatmapData.grid.map((row, dow) => (
                    <Fragment key={dow}>
                      <div className="text-xs text-muted-foreground flex items-center">{DAY_LABELS[dow]}</div>
                      {row.map((val, col) => (
                        <div
                          key={`${dow}-${col}`}
                          className="rounded-sm"
                          style={{
                            aspectRatio: "1",
                            backgroundColor: val === 0 ? "hsl(var(--muted))" : `hsl(217, 91%, ${Math.max(20, 60 - (val / heatmapData.max) * 50)}%)`,
                            opacity: val === 0 ? 0.3 : 0.8,
                          }}
                          title={`${DAY_LABELS[dow]} ${col * 2}h: ${val} vente(s)`}
                        />
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                <span>Faible</span>
                <div className="flex gap-0.5">
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
                    <div key={o} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `hsl(217, 91%, ${Math.max(20, 60 - o * 50)}%)`, opacity: 0.8 }} />
                  ))}
                </div>
                <span>Élevé</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SANTÉ MAGASIN ─── */}
        <TabsContent value="health" className="mt-4 space-y-4">
          {health && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <StoreHealthGauge score={health.score} level={health.level} size="lg" />
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base">Détails</CardTitle></CardHeader>
                <CardContent>
                  <HealthDetails health={health} />
                </CardContent>
              </Card>
              {health.recommendations.length > 0 && (
                <Card className="md:col-span-3">
                  <CardHeader><CardTitle className="text-base">Recommandations</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {health.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── ALERTES ─── */}
        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Alertes stock</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.map((a: any) => (
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
    </div>
  );

  return (
    <DashboardLayout role="salon_admin" title="Rapports" subtitle="Analyses et indicateurs avancés">
      <StaggerContainer>
        <StaggerItem>
          {content}
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
