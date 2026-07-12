import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { listSales } from "@/modules/stationery/services/sales";
import { listExpenses } from "@/modules/stationery/services/expenses";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import { toast } from "sonner";

export default function Reports() {
  const businessId = useStationeryBusinessId();
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({ revenue: 0, expenses: 0, profit: 0 });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!businessId) return;
      setLoading(true);
      try {
        const [sales, expenses] = await Promise.all([
          listSales(businessId, null),
          listExpenses(businessId, null)
        ]);

        // Calculate Totals
        const totalRev = sales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
        const totalExp = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
        setMetrics({ revenue: totalRev, expenses: totalExp, profit: totalRev - totalExp });

        // Build Chart Data (Group by date, last 7 days simplified)
        const daysMap = new Map();
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          daysMap.set(d.toISOString().split("T")[0], { date: d.toLocaleDateString("fr-FR", { weekday: 'short' }), revenue: 0, expenses: 0 });
        }

        sales.forEach(s => {
          const dStr = s.created_at.split("T")[0];
          if (daysMap.has(dStr)) {
             const existing = daysMap.get(dStr);
             daysMap.set(dStr, { ...existing, revenue: existing.revenue + (s.total_amount || 0) });
          }
        });

        expenses.forEach(e => {
          const dStr = e.expense_date.split("T")[0];
          if (daysMap.has(dStr)) {
             const existing = daysMap.get(dStr);
             daysMap.set(dStr, { ...existing, expenses: existing.expenses + (e.amount || 0) });
          }
        });

        setChartData(Array.from(daysMap.values()));

      } catch (e: any) {
        toast.error("Erreur de chargement des rapports");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [businessId]);

  return (
    <DashboardLayout role="salon_admin" title="Rapports & Analyses" subtitle="Performances financières de la papeterie">
      <StaggerContainer>
        {loading ? (
           <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <StaggerItem>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card className="border-0 shadow-sm bg-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Chiffre d'Affaires</p>
                        <p className="text-3xl font-bold text-emerald-500">{format(metrics.revenue)}</p>
                      </div>
                      <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                        <DollarSign className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Total Dépenses</p>
                        <p className="text-3xl font-bold text-destructive">{format(metrics.expenses)}</p>
                      </div>
                      <div className="p-3 bg-destructive/10 rounded-xl text-destructive">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Bénéfice Net</p>
                        <p className={`text-3xl font-bold ${metrics.profit >= 0 ? "text-primary" : "text-destructive"}`}>
                          {format(metrics.profit)}
                        </p>
                      </div>
                      <div className={`p-3 rounded-xl ${metrics.profit >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                        {metrics.profit >= 0 ? <TrendingUp className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </StaggerItem>

            <StaggerItem>
              <Card className="border-0 shadow-sm bg-card mb-6">
                <CardHeader>
                  <CardTitle>Revenus vs Dépenses (7 derniers jours)</CardTitle>
                  <CardDescription>Comparaison journalière des flux de trésorerie</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number, name: string) => [format(value), name === "revenue" ? "Revenus" : "Dépenses"]}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="revenue" name="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                        <Bar dataKey="expenses" name="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </>
        )}
      </StaggerContainer>
    </DashboardLayout>
  );
}
