import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, FileText, Eye, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import type { SchoolInvoice, SchoolStudent, SchoolAcademicYear } from "@/modules/school/types";
import { format } from "date-fns";

export default function SchoolInvoices() {
  const { user, profile, isAuthenticated } = useAuth();
  const { format: formatAmount } = useCurrency();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [invoices, setInvoices] = useState<SchoolInvoice[]>([]);
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [academicYears, setAcademicYears] = useState<SchoolAcademicYear[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    if (!businessId) return;
    try {
      setIsLoading(true);
      const [invRes, studRes, yearRes] = await Promise.all([
        supabase
          .from("school_invoices")
          .select("*, student:student_id(*), academic_year:academic_year_id(*)")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),
        supabase.from("school_students").select("*").eq("business_id", businessId).order("last_name"),
        supabase.from("school_academic_years").select("*").eq("business_id", businessId).order("name", { ascending: false })
      ]);

      if (invRes.error) throw invRes.error;
      if (studRes.error) throw studRes.error;
      if (yearRes.error) throw yearRes.error;

      setInvoices(invRes.data || []);
      setStudents(studRes.data || []);
      setAcademicYears(yearRes.data || []);
    } catch (error: any) {
      toast.error("Erreur de chargement", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, businessId]);

  const filteredInvoices = invoices.filter(inv => {
    const studentName = `${inv.student?.first_name} ${inv.student?.last_name}`.toLowerCase();
    const matricule = (inv.student?.matricule || "").toLowerCase();
    const invoiceNumber = (inv.invoice_number || "").toLowerCase();
    const s = search.toLowerCase();
    return studentName.includes(s) || matricule.includes(s) || invoiceNumber.includes(s);
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'paid': return 'bg-success/10 text-success';
      case 'partial': return 'bg-warning/10 text-warning';
      case 'overdue': return 'bg-destructive/10 text-destructive';
      case 'draft': return 'bg-muted text-muted-foreground';
      default: return 'bg-primary/10 text-primary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'paid': return 'Payé';
      case 'partial': return 'Partiel';
      case 'overdue': return 'En Retard';
      case 'draft': return 'Brouillon';
      default: return 'En attente';
    }
  };

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Factures & Plans de Paiement</h1>
            <p className="text-muted-foreground">
              Consultez les factures globales et les échéanciers par élève
            </p>
          </div>
          
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Générer une Facture
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6 flex flex-col justify-center">
              <span className="text-sm font-medium text-muted-foreground mb-2">Total Facturé (Année Active)</span>
              <span className="text-3xl font-bold">{formatAmount(invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0))}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex flex-col justify-center">
              <span className="text-sm font-medium text-muted-foreground mb-2">Total Encaissé</span>
              <span className="text-3xl font-bold text-success">{formatAmount(invoices.reduce((sum, inv) => sum + Number(inv.paid_amount), 0))}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex flex-col justify-center">
              <span className="text-sm font-medium text-muted-foreground mb-2">Total Impayés / Reste à Payer</span>
              <span className="text-3xl font-bold text-destructive">{formatAmount(invoices.reduce((sum, inv) => sum + Number(inv.balance), 0))}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <div className="p-4 border-b flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher une facture ou un élève..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm border-none shadow-none focus-visible:ring-0 px-0"
            />
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payé</TableHead>
                  <TableHead>Reste (Balance)</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Chargement...</TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune facture trouvée.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                          {inv.invoice_number}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Émis le {inv.issue_date ? format(new Date(inv.issue_date), "dd/MM/yyyy") : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{inv.student?.first_name} {inv.student?.last_name}</div>
                        <div className="text-xs text-muted-foreground">{inv.student?.matricule}</div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatAmount(inv.total_amount)}</TableCell>
                      <TableCell className="text-success font-medium">{formatAmount(inv.paid_amount)}</TableCell>
                      <TableCell className="text-destructive font-medium">{formatAmount(inv.balance)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                          {getStatusLabel(inv.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Voir les détails et plans de paiements">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-success" title="Encaisser un paiement">
                          <Wallet className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
