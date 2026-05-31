import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Building2, CreditCard, Users, TrendingUp, AlertTriangle, CheckCircle, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { glowupStore, Salon } from "@/lib/store";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";

export default function SuperAdminDashboard() {
  const { formatCompact } = useCurrency();
  const [stats, setStats] = useState([
    { title: "Salons actifs", value: "0", icon: <Building2 className="h-6 w-6" />, trend: { value: 12, isPositive: true } },
    { title: "Revenus mensuels", value: "0", icon: <CreditCard className="h-6 w-6" />, trend: { value: 8, isPositive: true } },
    { title: "Utilisateurs totaux", value: "0", icon: <Users className="h-6 w-6" />, trend: { value: 15, isPositive: true } },
    { title: "Croissance", value: "+23%", icon: <TrendingUp className="h-6 w-6" /> },
  ]);

  const [recentSalons, setRecentSalons] = useState<Salon[]>([]);
  const [subStats, setSubStats] = useState({ active: 0, expiring: 0, expired: 0 });
  const [partnerStats, setPartnerStats] = useState({ pending: 0, approved: 0, rejected: 0, suspended: 0 });

  const loadData = async () => {
    const salons = glowupStore.getSalons();

    // Sort chronologically by date desc (recent first)
    const sortedSalons = [...salons].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setRecentSalons(sortedSalons.slice(0, 5)); // show top 5

    // Counts
    const active = salons.filter(s => s.status === "active").length;
    const expiring = salons.filter(s => s.status === "expiring").length;
    const expired = salons.filter(s => s.status === "expired").length;
    setSubStats({ active, expiring, expired });

    const [{ data: businesses }, { data: subscriptions }, { data: branches }, { data: plans }, { data: partnerRows }] = await Promise.all([
      supabase.from("businesses").select("id, name, owner, status, created_at").order("created_at", { ascending: false }).limit(25),
      supabase.from("business_subscriptions").select("business_id, plan_id, status, price_snapshot, created_at").order("created_at", { ascending: false }),
      supabase.from("business_branches").select("id, business_id, active").order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("id, name, monthly_price, active"),
      supabase.from("partners").select("status"),
    ]);

    if (businesses && businesses.length > 0) {
      setRecentSalons(
        businesses.slice(0, 5).map((business: any) => ({
          id: business.id,
          name: business.name,
          owner: business.owner || "—",
          plan: "Basic",
          status: business.status === "inactive" ? "expired" : "active",
          date: business.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
        }))
      );
    }

    const planById = new Map((plans || []).map((plan: any) => [plan.id, plan]));
    const activeSubscriptions = (subscriptions || []).filter((subscription: any) => subscription.status === "active");
    const mrrTotal = activeSubscriptions.reduce((sum: number, subscription: any) => {
      const plan = planById.get(subscription.plan_id);
      const price = subscription.price_snapshot ?? plan?.monthly_price ?? 0;
      return sum + Number(price || 0);
    }, 0);
    const displaySalonsActifs = activeSubscriptions.length;
    const displayUsers = (branches || []).filter((branch: any) => branch.active !== false).length * 5;
    const partnerData = (partnerRows || []) as Array<{ status: string | null }>;
    setPartnerStats({
      pending: partnerData.filter((row) => row.status === "pending").length,
      approved: partnerData.filter((row) => row.status === "approved" || row.status === "active").length,
      rejected: partnerData.filter((row) => row.status === "rejected").length,
      suspended: partnerData.filter((row) => row.status === "suspended").length,
    });

    setStats([
      { title: "Salons actifs", value: displaySalonsActifs.toLocaleString(), icon: <Building2 className="h-6 w-6" />, trend: { value: 12, isPositive: true } },
      { title: "Revenus mensuels", value: formatCompact(mrrTotal), icon: <CreditCard className="h-6 w-6" />, trend: { value: 8, isPositive: true } },
      { title: "Utilisateurs totaux", value: displayUsers.toLocaleString(), icon: <Users className="h-6 w-6" />, trend: { value: 15, isPositive: true } },
      { title: "Croissance", value: "+23%", icon: <TrendingUp className="h-6 w-6" /> },
    ]);
  };

  useEffect(() => {
    void loadData();
    const handleUpdate = () => {
      void loadData();
    };
    window.addEventListener("glowup-store-update", handleUpdate);
    return () => window.removeEventListener("glowup-store-update", handleUpdate);
  }, [formatCompact]);

  return (
    <DashboardLayout
      role="super_admin"
      title="Dashboard Super Admin"
      subtitle="Vue d'ensemble de la plateforme"
      userName="Admin GlowUp"
    >
      <StaggerContainer className="space-y-8">
        {/* Stats Grid */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        </StaggerItem>

        <StaggerItem>
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm text-muted-foreground">Demandes Partenaires</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Vue rapide sur les candidatures à valider</p>
              </div>
              {partnerStats.pending > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  🔔 Nouvelle demande partenaire
                </Badge>
              ) : (
                <Badge variant="outline">Aucune alerte</Badge>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-2xl font-bold">{partnerStats.pending}</p>
                <p className="text-xs text-muted-foreground">Total en attente</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{partnerStats.approved}</p>
                <p className="text-xs text-muted-foreground">Total approuvées</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{partnerStats.rejected}</p>
                <p className="text-xs text-muted-foreground">Total refusées</p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold">{partnerStats.suspended}</p>
                  <p className="text-xs text-muted-foreground">Total suspendues</p>
                </div>
                <Link to="/admin/partners/applications">
                  <Button variant="outline" size="sm">
                    <Handshake className="mr-2 h-4 w-4" />
                    Voir la file
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Recent Salons */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold font-display">Salons récents</h2>
                <p className="text-sm text-muted-foreground">Dernières inscriptions et activités</p>
              </div>
              <Link to="/admin/salons">
                <Button variant="outline" size="sm">Voir tout</Button>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Salon</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Propriétaire</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Plan</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Statut</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSalons.map((salon) => (
                    <tr key={salon.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                            {salon.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-sm">{salon.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">{salon.owner}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          salon.plan === "Premium" ? "bg-warning/20 text-warning" :
                          salon.plan === "Pro" ? "bg-primary/20 text-primary" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {salon.plan}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                          salon.status === "active" ? "text-success" :
                          salon.status === "expiring" ? "text-warning" :
                          "text-destructive"
                        }`}>
                          {salon.status === "active" ? <CheckCircle className="h-4 w-4" /> :
                           <AlertTriangle className="h-4 w-4" />}
                          <span className="capitalize">{salon.status === "expiring" ? "Expire bientôt" : salon.status === "expired" ? "Expiré" : "Actif"}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">{salon.date.split("-").reverse().join("/")}</td>
                      <td className="p-4 text-right">
                        <Link to="/admin/salons">
                          <Button variant="ghost" size="sm" className="h-8">Gérer</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {recentSalons.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm font-medium">Aucun salon enregistré.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </StaggerItem>

        {/* Quick Stats Cards */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-success/10 text-success">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <span className="font-semibold text-sm">Abonnements actifs</span>
              </div>
              <p className="text-3xl font-bold font-display">{subStats.active * 35}</p>
              <p className="text-xs text-muted-foreground mt-1">Accès total autorisé</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-warning/10 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <span className="font-semibold text-sm">Expirent bientôt</span>
              </div>
              <p className="text-3xl font-bold font-display">{subStats.expiring * 35}</p>
              <p className="text-xs text-muted-foreground mt-1">Dans les 7 prochains jours</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <span className="font-semibold text-sm">Expirés</span>
              </div>
              <p className="text-3xl font-bold font-display">{subStats.expired * 35}</p>
              <p className="text-xs text-muted-foreground mt-1">Accès bloqué</p>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
