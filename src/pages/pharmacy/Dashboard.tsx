import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent } from "@/components/ui/card";
import { reportsService } from "@/modules/pharmacy/services/reportsService";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DollarSign, ShoppingCart, FileText, Package,
  AlertTriangle, TrendingUp, Pill, RefreshCw
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

// Reusable stat card adapted from Auto Parts / Stationery
function StatCard({
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

export default function PharmacyDashboard() {
  const { t } = useTranslation();
  const businessId = usePharmacyBusinessId();
  const { profile } = useAuth();
  const { format } = useCurrency();

  const [stats, setStats] = useState<any>(null);
  const [salesEvolution, setSalesEvolution] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<any[]>([]);
  const [categoryDist, setCategoryDist] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    
    const load = async () => {
      try {
        const [
          dataStats, dataSalesEvo, dataTopProd, dataOos, dataCat, dataRecent
        ] = await Promise.all([
          reportsService.getDashboardStats(businessId),
          reportsService.getSalesEvolution(businessId, days),
          reportsService.getTopProducts(businessId, 5),
          reportsService.getOutOfStockItems(businessId, 5),
          reportsService.getCategoryDistribution(businessId),
          reportsService.getRecentActivity(businessId, 5)
        ]);
        
        setStats(dataStats);
        setSalesEvolution(dataSalesEvo);
        setTopProducts(dataTopProd);
        setOutOfStockItems(dataOos);
        setCategoryDist(dataCat);
        setRecentActivity(dataRecent);
      } catch (error) {
        console.error("Dashboard error", error);
      } finally {
        setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(iv);
  }, [businessId, days]);

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Tableau de bord" subtitle="Vue globale Pharmacie">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <Card key={i} className="h-24 animate-pulse bg-muted/40 border-0 shadow-sm" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Tableau de bord" subtitle={`Bienvenue, ${profile?.full_name || "Administrateur"}`}>
      <StaggerContainer className="space-y-6">
        
        {/* ── 5 KPIs essentiels ── */}
        <StaggerItem>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activité de la Pharmacie</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              icon={<DollarSign className="h-5 w-5" />}
              label="CA aujourd'hui"
              value={format(stats?.salesToday ?? 0)}
              sub="Ventes actives"
              accent="green"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="CA du mois"
              value={format(stats?.salesMonth ?? 0)}
              sub="Mois en cours"
              accent="indigo"
            />
            <StatCard
              icon={<ShoppingCart className="h-5 w-5" />}
              label="Ventes aujourd'hui"
              value={stats?.invoicesToday ?? 0}
              sub="Tickets émis"
              accent="violet"
            />
            <StatCard
              icon={<FileText className="h-5 w-5" />}
              label="Ventes du mois"
              value={stats?.invoicesMonth ?? 0}
              sub="Total des tickets"
              accent="cyan"
            />
            <StatCard
              icon={<Pill className="h-5 w-5" />}
              label="Catalogue"
              value={stats?.totalProducts ?? 0}
              sub="Produits référencés"
              accent="orange"
            />
          </div>
        </StaggerItem>

        {/* ── Alertes & KPIs Secondaires ── */}
        <StaggerItem>
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-900/30 bg-red-950/20 text-red-400 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" /> {stats?.outOfStock || 0} références en rupture
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-900/30 bg-amber-950/20 text-amber-400 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" /> {stats?.lowStock || 0} références à stock faible
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-900/30 bg-blue-950/20 text-blue-400 text-sm font-medium">
              <Package className="h-4 w-4" /> Valeur du stock : {format(stats?.totalStockValue || 0)}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-900/30 bg-emerald-950/20 text-emerald-400 text-sm font-medium">
              <TrendingUp className="h-4 w-4" /> Valeur potentielle : {format(stats?.totalPotentialRevenue || 0)}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-purple-900/30 bg-purple-950/20 text-purple-400 text-sm font-medium">
              <DollarSign className="h-4 w-4" /> Marge potentielle : {format(stats?.potentialMargin || 0)}
            </div>
          </div>
        </StaggerItem>

        {/* ── Graphique d'évolution des ventes ── */}
        <StaggerItem>
          <Card className="border-0 shadow-sm p-4">
            <div className="flex justify-between items-center mb-6">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Evolution des ventes</p>
              <div className="flex gap-2">
                <button onClick={() => setDays(7)} className={`px-3 py-1 text-xs rounded-md border ${days === 7 ? 'bg-primary/10 border-primary/20 text-primary font-medium' : 'hover:bg-muted'}`}>7 jours</button>
                <button onClick={() => setDays(30)} className={`px-3 py-1 text-xs rounded-md border ${days === 30 ? 'bg-primary/10 border-primary/20 text-primary font-medium' : 'hover:bg-muted'}`}>30 jours</button>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesEvolution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${format(value)}`, 'Ventes']}
                    labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </StaggerItem>

        {/* ── 3 Colonnes : Top, Ruptures, Catégories ── */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Top Produits */}
            <Card className="border-0 shadow-sm p-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Top Médicaments</p>
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

            {/* Ruptures */}
            <Card className="border-0 shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Rupture de Stock</p>
                <span className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">{stats?.outOfStock || 0}</span>
              </div>
              <div className="space-y-3">
                {outOfStockItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune rupture.</p>}
                {outOfStockItems.map((p, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="font-medium truncate pr-2">{p.name}</span>
                    <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors flex-shrink-0">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Catégories */}
            <Card className="border-0 shadow-sm p-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Par Catégorie</p>
              <div className="flex items-center justify-between">
                <div className="h-[120px] w-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDist}
                        innerRadius={40}
                        outerRadius={55}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryDist.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [`${value} articles`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 pl-4 space-y-2">
                  {categoryDist.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center text-xs">
                      <div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: c.fill }} />
                      <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
                      <span className="font-medium ml-2">{c.percentage}%</span>
                    </div>
                  ))}
                  {categoryDist.length > 3 && (
                    <div className="flex items-center text-xs">
                      <div className="h-2 w-2 rounded-full mr-2 bg-muted-foreground" />
                      <span className="flex-1 truncate text-muted-foreground">Autres</span>
                      <span className="font-medium ml-2">
                        {categoryDist.slice(3).reduce((acc, c) => acc + c.percentage, 0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

          </div>
        </StaggerItem>

        {/* ── Activité Récente ── */}
        <StaggerItem>
          <Card className="border-0 shadow-sm p-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Activité Récente</p>
            <div className="space-y-0">
              {recentActivity.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune vente récente.</p>}
              {recentActivity.map((act, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 text-sm">
                  <div className="w-16 text-muted-foreground">{act.time}</div>
                  <div className="flex-1 font-medium">Ticket #{act.invoice}</div>
                  <div className="w-16 text-center text-muted-foreground">{act.initials}</div>
                  <div className="w-24 text-right font-medium text-emerald-500">{format(act.amount)}</div>
                </div>
              ))}
            </div>
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
