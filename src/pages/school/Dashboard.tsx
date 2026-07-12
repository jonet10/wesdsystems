import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, Wallet, FileText, ArrowUpRight, ArrowDownRight, Package, UserCog, Library, School, Milestone, Layers, CheckCircle2, BookOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { useSchool } from "@/hooks/useSchool";
import { SchoolCapability } from "@/modules/school/engine/types";

export default function SchoolDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { format: formatAmount } = useCurrency();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const { engine } = useSchool();

  const [stats, setStats] = useState<any>({
    totalStudents: 0,
    totalTeachers: 0,
    totalRevenue: 0,
    totalPending: 0,
    totalExpenses: 0,
    totalStockValue: 0,
    extraStats: {
      totalClasses: 0,
      totalFaculties: 0,
      totalDepartments: 0,
      totalPromotions: 0
    }
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
          { data: products },
          { data: teachers }
        ] = await Promise.all([
          supabase.from("school_students").select("*", { count: "exact", head: true }).eq("business_id", businessId),
          supabase.from("school_teachers").select("*", { count: "exact", head: true }).eq("business_id", businessId),
          supabase.from("school_invoices").select("paid_amount, balance").eq("business_id", businessId),
          supabase.from("school_expenses").select("amount").eq("business_id", businessId),
          supabase.from("school_products").select("price, stock_quantity").eq("business_id", businessId).eq("active", true),
          supabase.from("school_teachers").select("salary").eq("business_id", businessId).eq("active", true)
        ]);

        const revenue = invoices?.reduce((sum, inv) => sum + Number(inv.paid_amount), 0) || 0;
        const pending = invoices?.reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;
        const totalExp = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
        const stockValue = products?.reduce((sum, p) => sum + (Number(p.price) * Number(p.stock_quantity)), 0) || 0;
        const expectedPayroll = teachers?.reduce((sum, t) => sum + (Number(t.salary) || 0), 0) || 0;

        const netBalance = revenue - totalExp;

        // Notification Logic for Payroll
        if (expectedPayroll > 0 && netBalance < expectedPayroll && user) {
          const alertId = `payroll-alert-${new Date().getFullYear()}-${new Date().getMonth()}`;
          const { data: existingAlert } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("title", "Alerte Paie")
            .contains("metadata", { alert_id: alertId })
            .limit(1);

          if (!existingAlert || existingAlert.length === 0) {
            await supabase.from("notifications").insert({
              user_id: user.id,
              recipient_role: "salon_admin",
              type: "warning",
              title: "Alerte Paie",
              message: `Le solde en caisse (${revenue - totalExp} G) est inférieur à la masse salariale estimée de ce mois (${expectedPayroll} G).`,
              metadata: { alert_id: alertId, business_id: businessId }
            });
            toast.warning(`Attention : Le solde en caisse est inférieur au montant estimé des salaires (${expectedPayroll} G).`);
          }
        }

        const extra = await engine.dashboard.getDashboardStatsQuery(businessId, supabase);

        setStats({
          totalStudents: studentsCount || 0,
          totalTeachers: teachersCount || 0,
          totalRevenue: revenue,
          totalPending: pending,
          totalExpenses: totalExp,
          totalStockValue: stockValue,
          extraStats: {
            totalClasses: extra.totalClasses || 0,
            totalFaculties: extra.totalFaculties || 0,
            totalDepartments: extra.totalDepartments || 0,
            totalPromotions: extra.totalPromotions || 0
          }
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
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord - {engine.getActivePlugin().name}</h1>
          <p className="text-muted-foreground">Vue d'ensemble de l'établissement et des finances.</p>
        </div>

        <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{engine.terminology.get("students")} Inscrits</CardTitle>
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
                <CardTitle className="text-sm font-medium">{engine.terminology.get("teachers")}</CardTitle>
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
                <CardTitle className="text-sm font-medium">Nombre de {engine.terminology.get("classes")}</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.extraStats.totalClasses}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {engine.getActivePlugin().id === "CLASSIC"
                    ? "Classes actives dans l'établissement"
                    : engine.getActivePlugin().id === "VOCATIONAL"
                      ? "Modules de formation actifs"
                      : "Nombre total de filières / groupes d'études"}
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          {engine.hasCapability(SchoolCapability.MANAGE_FACULTIES) && (
            <StaggerItem>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Facultés</CardTitle>
                  <School className="h-4 w-4 text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.extraStats.totalFaculties}</div>
                  <p className="text-xs text-muted-foreground mt-1">Unités universitaires</p>
                </CardContent>
              </Card>
            </StaggerItem>
          )}

          {engine.hasCapability(SchoolCapability.MANAGE_DEPARTMENTS) && (
            <StaggerItem>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Départements</CardTitle>
                  <Library className="h-4 w-4 text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.extraStats.totalDepartments}</div>
                  <p className="text-xs text-muted-foreground mt-1">Départements d'études</p>
                </CardContent>
              </Card>
            </StaggerItem>
          )}

          {engine.hasCapability(SchoolCapability.MANAGE_COHORTS) && (
            <StaggerItem>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Promotions / Cohortes</CardTitle>
                  <Milestone className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.extraStats.totalPromotions}</div>
                  <p className="text-xs text-muted-foreground mt-1">Groupes d'apprenants par promotion</p>
                </CardContent>
              </Card>
            </StaggerItem>
          )}

          <StaggerItem>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenus Bruts</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatAmount(stats.totalRevenue)}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center">
                  <ArrowUpRight className="h-3 w-3 mr-1 text-success" /> Entrées totales encaissées
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">Solde en Caisse</CardTitle>
                <Wallet className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{formatAmount(stats.totalRevenue - stats.totalExpenses)}</div>
                <p className="text-xs text-muted-foreground mt-1">Revenus bruts moins dépenses</p>
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

        {/* Section Académique (Phase 5) */}
        <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
          <StaggerItem>
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-700">Taux de Présence Global</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">92%</div>
                <p className="text-xs text-muted-foreground mt-1">Élèves présents aujourd'hui</p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-amber-700">Retards (Aujourd'hui)</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">14</div>
                <p className="text-xs text-muted-foreground mt-1">Dépassement du seuil de tolérance</p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="border-indigo-500/20 bg-indigo-500/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-indigo-700">Notes Soumises</CardTitle>
                <FileText className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">12 / 45</div>
                <p className="text-xs text-muted-foreground mt-1">Classes ayant verrouillé leurs notes</p>
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
                  <p className="text-sm text-muted-foreground">Inscrire un nouvel {engine.terminology.get("student").toLowerCase()}</p>
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
