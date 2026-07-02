import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, Wallet, FileText, ArrowUpRight, ArrowDownRight, Package, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";

export default function SchoolDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { format: formatAmount } = useCurrency();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalRevenue: 0,
    totalPending: 0,
    totalExpenses: 0,
    totalStockValue: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!businessId) return;

      try {
        const [
          { count: studentsCount },
          { count: teachersCount },
          { data: invoices },
          { data: expenses },
          { data: products }
        ] = await Promise.all([
          supabase.from("school_students").select("*", { count: "exact", head: true }).eq("business_id", businessId),
          supabase.from("school_teachers").select("*", { count: "exact", head: true }).eq("business_id", businessId),
          supabase.from("school_invoices").select("paid_amount, balance").eq("business_id", businessId),
          supabase.from("school_expenses").select("amount").eq("business_id", businessId),
          supabase.from("school_products").select("price, stock_quantity").eq("business_id", businessId).eq("active", true)
        ]);

        const revenue = invoices?.reduce((sum, inv) => sum + Number(inv.paid_amount), 0) || 0;
        const pending = invoices?.reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;
        const totalExp = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
        const stockValue = products?.reduce((sum, p) => sum + (Number(p.price) * Number(p.stock_quantity)), 0) || 0;

        setStats({
          totalStudents: studentsCount || 0,
          totalTeachers: teachersCount || 0,
          totalRevenue: revenue,
          totalPending: pending,
          totalExpenses: totalExp,
          totalStockValue: stockValue
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, [businessId]);

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord École</h1>
          <p className="text-muted-foreground">Vue d'ensemble de l'établissement et des finances.</p>
        </div>

        <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Élèves Inscrits</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalStudents}</div>
                <p className="text-xs text-muted-foreground mt-1">Actifs dans le système</p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Professeurs</CardTitle>
                <UserCog className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTeachers}</div>
                <p className="text-xs text-muted-foreground mt-1">Membres du personnel enseignant</p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenus (Encaissés)</CardTitle>
                <Wallet className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatAmount(stats.totalRevenue)}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center">
                  <ArrowUpRight className="h-3 w-3 mr-1 text-success" /> Entrées confirmées
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reste à Payer</CardTitle>
                <FileText className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{formatAmount(stats.totalPending)}</div>
                <p className="text-xs text-muted-foreground mt-1">Factures non soldées</p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dépenses</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatAmount(stats.totalExpenses)}</div>
                <p className="text-xs text-muted-foreground mt-1">Sorties totales</p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valeur du Stock</CardTitle>
                <Package className="h-4 w-4 text-cyan-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-500">{formatAmount(stats.totalStockValue)}</div>
                <p className="text-xs text-muted-foreground mt-1">Fournitures disponibles</p>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>
        
        {/* We can add a chart here later. For now, this is a clean start. */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Bilan Financier Récent</CardTitle>
            </CardHeader>
            <CardContent className="pl-2 flex justify-center items-center h-64 text-muted-foreground">
              {/* Placeholder for Recharts if needed */}
              Graphique des entrées/sorties à venir.
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Raccourcis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                onClick={() => navigate("/school/students")}
                className="flex items-center p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <div className="bg-primary/10 p-2 rounded-full mr-4">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">Nouveau Dossier</h4>
                  <p className="text-sm text-muted-foreground">Inscrire un nouvel élève</p>
                </div>
              </div>
              <div 
                onClick={() => navigate("/school/invoices")}
                className="flex items-center p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <div className="bg-primary/10 p-2 rounded-full mr-4">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">Facturation</h4>
                  <p className="text-sm text-muted-foreground">Gérer les frais de scolarité</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
