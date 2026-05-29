import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar,
  Download, ArrowUpDown, PieChart, Wallet
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RePieChart, Pie, Cell, Legend,
} from "recharts";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

const COLORS = ["#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];

export default function ReportsPage() {
  const { format: fmt } = useCurrency();
  const [period, setPeriod] = useState("month");
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "week":
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { start: format(weekAgo, "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "month":
        return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
      case "quarter":
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        return { start: format(quarterAgo, "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      case "year":
        return { start: format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
      default:
        return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
    }
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [salesRes, expensesRes] = await Promise.all([
        supabase
          .from("salon_sales")
          .select("id, total_amount, discount_amount, tax_amount, payment_method, created_at")
          .gte("created_at", `${dateRange.start}T00:00:00`)
          .lte("created_at", `${dateRange.end}T23:59:59`)
          .order("created_at"),
        supabase
          .from("salon_expenses")
          .select("id, category, amount, created_at")
          .gte("created_at", `${dateRange.start}T00:00:00`)
          .lte("created_at", `${dateRange.end}T23:59:59`)
          .order("created_at"),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setSales(salesRes.data || []);
      setExpenses(expensesRes.data || []);
    } catch (err: any) {
      toast.error("Erreur chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [dateRange]);

  const totalRevenue = sales.reduce((s, sale) => s + Number(sale.total_amount || 0), 0);
  const totalExpenses = expenses.reduce((s, exp) => s + Number(exp.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalTransactions = sales.length;

  const dailyData = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number; count: number }>();
    sales.forEach(sale => {
      const day = sale.created_at.split("T")[0];
      const existing = map.get(day) || { revenue: 0, expenses: 0, count: 0 };
      existing.revenue += Number(sale.total_amount || 0);
      existing.count += 1;
      map.set(day, existing);
    });
    expenses.forEach(exp => {
      const day = exp.created_at.split("T")[0];
      const existing = map.get(day) || { revenue: 0, expenses: 0, count: 0 };
      existing.expenses += Number(exp.amount || 0);
      map.set(day, existing);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));
  }, [sales, expenses]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(sale => {
      const method = sale.payment_method || "cash";
      map.set(method, (map.get(method) || 0) + Number(sale.total_amount || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [sales]);

  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(exp => {
      map.set(exp.category, (map.get(exp.category) || 0) + Number(exp.amount || 0));
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const topServices = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(sale => {
      const method = sale.payment_method || "Autre";
      map.set(method, (map.get(method) || 0) + 1);
    });
    return Array.from(map.entries()).slice(0, 5);
  }, [sales]);

  const paymentLabels: Record<string, string> = {
    cash: "Espèces", moncash: "MonCash", natcash: "NatCash", card: "Carte",
  };

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Rapports" subtitle="Analyses et statistiques">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Rapports" subtitle="Analyse des performances du salon">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              {["week", "month", "quarter", "year"].map(p => (
                <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
                  {p === "week" ? "7 jours" : p === "month" ? "Ce mois" : p === "quarter" ? "3 mois" : "Cette année"}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadData}>
                <Calendar className="h-4 w-4 mr-2" /> Actualiser
              </Button>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenus</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <p className="text-2xl font-bold text-success">{fmt(totalRevenue)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{totalTransactions} transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Dépenses</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  <p className="text-2xl font-bold text-destructive">{fmt(totalExpenses)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Bénéfice net</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                    {fmt(netProfit)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Marge bénéficiaire</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(1)}%` : "0%"}
                </p>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Revenus & Dépenses quotidiens</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v?.slice(5) || ""} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenus" />
                    <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Dépenses" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Répartition des paiements</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${paymentLabels[name] || name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {paymentBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Dépenses par catégorie</CardTitle></CardHeader>
              <CardContent className="h-72">
                {expenseBreakdown.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Aucune dépense enregistrée
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Montant" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Tendance des revenus</CardTitle></CardHeader>
              <CardContent className="h-72">
                {dailyData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Aucune donnée disponible
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v?.slice(5) || ""} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Revenus" />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Dépenses" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Résumé de la période</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Période</p>
                  <p className="font-semibold">{dateRange.start} → {dateRange.end}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ventes</p>
                  <p className="font-semibold">{totalTransactions}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ticket moyen</p>
                  <p className="font-semibold">{totalTransactions > 0 ? fmt(totalRevenue / totalTransactions) : fmt(0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ratio dépenses/revenus</p>
                  <p className="font-semibold">{totalRevenue > 0 ? `${((totalExpenses / totalRevenue) * 100).toFixed(1)}%` : "0%"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
