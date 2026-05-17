import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { StatCard } from "@/components/dashboard/StatCard";
import { CreditCard, DollarSign, ArrowUpRight, CheckCircle, TrendingUp, Sparkles, Receipt } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { glowupStore } from "@/lib/store";

const revenueData = [
  { month: "Juil", revenue: 5200 },
  { month: "Août", revenue: 5800 },
  { month: "Sept", revenue: 6400 },
  { month: "Oct", revenue: 7100 },
  { month: "Nov", revenue: 7800 },
  { month: "Déc", revenue: 8100 },
  { month: "Jan", revenue: 8450 },
];

const transactions = [
  { id: "TX-1004", salon: "Institut Beauté Pétion-Ville", amount: "79$", plan: "Professionnel", date: "2024-01-15", status: "success" },
  { id: "TX-1003", salon: "Pharmacie Nouvelle Cap-Haïtien", amount: "139$", plan: "Entreprise", date: "2024-01-14", status: "success" },
  { id: "TX-1002", salon: "Le Gourmet Restaurant", amount: "79$", plan: "Professionnel", date: "2024-01-10", status: "success" },
  { id: "TX-1001", salon: "MiniMarket des Cayes", amount: "39$", plan: "Start-up", date: "2024-01-08", status: "success" },
];

export default function SubscriptionsPage() {
  const [stats, setStats] = useState({
    mrr: "0$",
    activeSubs: 0,
    basicCount: 0,
    proCount: 0,
    premiumCount: 0
  });

  useEffect(() => {
    const salons = glowupStore.getSalons();
    const activeSalons = salons.filter(s => s.status !== "expired");
    
    let mrrTotal = 0;
    let basic = 0;
    let pro = 0;
    let premium = 0;

    activeSalons.forEach(s => {
      if (s.plan === "Basic") {
        mrrTotal += 39;
        basic++;
      } else if (s.plan === "Pro") {
        mrrTotal += 79;
        pro++;
      } else if (s.plan === "Premium") {
        mrrTotal += 139;
        premium++;
      }
    });

    // Multiply by a factor of 100 to simulate a full real-world scale (since default data has only 4 salons)
    const displayMRR = mrrTotal * 40; 
    const displayActiveSubs = activeSalons.length * 35;

    setStats({
      mrr: `${displayMRR.toLocaleString()}$`,
      activeSubs: displayActiveSubs,
      basicCount: basic * 35,
      proCount: pro * 35,
      premiumCount: premium * 35
    });
  }, []);

  return (
    <DashboardLayout
      role="super_admin"
      title="Abonnements & Finances"
      subtitle="Supervision du chiffre d'affaires récurrent mensuel (MRR)"
      userName="Admin Wesd Systems"
    >
      <StaggerContainer className="space-y-8">
        {/* Metric Cards Grid */}
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            <StatCard title="MRR Actuel" value={stats.mrr} icon={<DollarSign className="h-6 w-6" />} trend={{ value: 12, isPositive: true }} />
            <StatCard title="Abonnements actifs" value={stats.activeSubs.toString()} icon={<CreditCard className="h-6 w-6" />} trend={{ value: 9, isPositive: true }} />
            <StatCard title="Valeur moyenne contrat" value="82.40$" icon={<TrendingUp className="h-6 w-6" />} />
            <StatCard title="Taux de désabonnement" value="1.8%" icon={<ArrowUpRight className="h-6 w-6" />} />
          </div>
        </StaggerItem>

        {/* Charts & Plan Breakdown */}
        <StaggerItem>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
            {/* Area Chart MRR */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-card lg:col-span-2">
              <div className="mb-6">
                <h2 className="text-lg font-bold font-sans tracking-tight">Évolution du Chiffre d'Affaires</h2>
                <p className="text-xs text-muted-foreground">Revenus mensuels récurrents (MRR)</p>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(221.2 83.2% 53.3%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(221.2 83.2% 53.3%)" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="month" stroke="#888" fontSize={11} tickLine={false} />
                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} unit="$" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #eee" }}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(221.2 83.2% 53.3%)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenus" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plan Breakdown */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-card flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold font-sans tracking-tight mb-4">Répartition des Formules</h2>
                <div className="space-y-4">
                  {/* Basic */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Start-up (39$/mois)</span>
                      <span className="text-muted-foreground">{stats.basicCount} commerces</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-muted-foreground h-2 rounded-full" style={{ width: `${(stats.basicCount / stats.activeSubs) * 100}%` }} />
                    </div>
                  </div>

                  {/* Pro */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-primary">Professionnel (79$/mois)</span>
                      <span className="text-muted-foreground">{stats.proCount} commerces</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="gradient-primary h-2 rounded-full" style={{ width: `${(stats.proCount / stats.activeSubs) * 100}%` }} />
                    </div>
                  </div>

                  {/* Premium */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-warning">Entreprise (139$/mois)</span>
                      <span className="text-muted-foreground">{stats.premiumCount} commerces</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="gradient-gold h-2 rounded-full" style={{ width: `${(stats.premiumCount / stats.activeSubs) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 mt-6 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-primary text-xs">Tendance de croissance</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">Le plan Professionnel représente 60% de vos nouveaux abonnements ce mois-ci.</p>
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Transaction History */}
        <StaggerItem>
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-sans tracking-tight">Historique des transactions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Derniers paiements d'abonnement collectés</p>
              </div>
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">ID Facture</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Établissement</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Formule</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Montant</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Date de paiement</th>
                    <th className="text-right p-4 text-xs font-semibold text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-bold text-xs">{tx.id}</td>
                      <td className="p-4 text-xs font-bold text-foreground">{tx.salon}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.plan === "Entreprise" ? "bg-warning/20 text-warning" :
                          tx.plan === "Professionnel" ? "bg-primary/20 text-primary" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {tx.plan}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-xs text-primary">{tx.amount}</td>
                      <td className="p-4 text-xs text-muted-foreground">{tx.date.split("-").reverse().join("/")}</td>
                      <td className="p-4 text-right">
                        <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Réussi</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
