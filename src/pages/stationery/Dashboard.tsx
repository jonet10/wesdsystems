import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent } from "@/components/ui/card";
import { stationeryDashboardStats } from "@/modules/stationery/services/reports";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DollarSign, ShoppingCart, FileText, Package,
  AlertTriangle, TrendingUp, Users, BookOpen
} from "lucide-react";

// Reusable stat card adapted from Auto Parts
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

export default function StationeryDashboardPage() {
  const { t } = useTranslation();
  const businessId = useStationeryBusinessId();
  const { profile } = useAuth();
  const { format } = useCurrency();

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    
    const load = async () => {
      try {
        const data = await stationeryDashboardStats(businessId);
        setStats(data);
      } catch (error) {
        console.error("Dashboard error", error);
      } finally {
        setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(iv);
  }, [businessId]);

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Tableau de bord" subtitle="Vue globale Papeterie">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <Card key={i} className="h-24 animate-pulse bg-muted/40 border-0 shadow-sm" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Tableau de bord" subtitle={`Bienvenue, ${profile?.name || "Administrateur"}`}>
      <StaggerContainer className="space-y-6">
        
        {/* ── 5 KPIs essentiels ── */}
        <StaggerItem>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activité de la Papeterie</p>
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
              icon={<BookOpen className="h-5 w-5" />}
              label="Catalogue"
              value={stats?.totalProducts ?? 0}
              sub="Produits référencés"
              accent="orange"
            />
          </div>
        </StaggerItem>

        {/* ── Alertes & KPIs Secondaires ── */}
        {(stats?.outOfStock > 0 || stats?.lowStock > 0) && (
          <StaggerItem>
            <div className="flex flex-wrap gap-3 mt-4">
              {stats.outOfStock > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span><strong>{stats.outOfStock}</strong> produit{stats.outOfStock > 1 ? "s" : ""} en rupture de stock !</span>
                </div>
              )}
              {stats.lowStock > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span><strong>{stats.lowStock}</strong> produit{stats.lowStock > 1 ? "s" : ""} avec stock faible.</span>
                </div>
              )}
            </div>
          </StaggerItem>
        )}

      </StaggerContainer>
    </DashboardLayout>
  );
}
