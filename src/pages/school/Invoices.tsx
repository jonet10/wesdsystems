import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ExportButtons } from "@/components/school/ExportButtons";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { supabase } from "@/lib/supabase";
import type { SchoolInvoice, SchoolStudent, SchoolAcademicYear, SchoolClass, SchoolFee, SchoolFeeCategory } from "@/modules/school/types";
import { format } from "date-fns";

export default function SchoolInvoices() {
  const navigate = useNavigate();
  const { user, profile, isAuthenticated } = useAuth();
  const { settings, activeAcademicYear } = useSchoolSettings();
  const { format: formatAmount } = useCurrency();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [invoices, setInvoices] = useState<SchoolInvoice[]>([]);
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [academicYears, setAcademicYears] = useState<SchoolAcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    if (!businessId) return;
    try {
      setIsLoading(true);
      const [invRes, studRes, yearRes, classRes, feesRes] = await Promise.all([
        supabase
          .from("school_invoices")
          .select("*, student:student_id(*), academic_year:academic_year_id(*)")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false }),
        supabase.from("school_students").select("*").eq("business_id", businessId).order("last_name"),
        supabase.from("school_academic_years").select("*").eq("business_id", businessId).order("name", { ascending: false }),
        supabase.from("school_classes").select("*").eq("business_id", businessId).order("name"),
        supabase.from("school_fees").select("*, category:category_id(*)").eq("business_id", businessId),
      ]);

      if (invRes.error) throw invRes.error;
      if (studRes.error) throw studRes.error;
      if (yearRes.error) throw yearRes.error;

      setInvoices(invRes.data || []);
      setStudents(studRes.data || []);
      setAcademicYears(yearRes.data || []);
      if (classRes.data) setClasses(classRes.data);
      if (feesRes.data) setFees(feesRes.data);
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

  const exportColumns = [
    { header: "N° Facture", accessorKey: "invoice_number" },
    { header: "Date", accessorKey: "issue_date", cell: (i: any) => i.issue_date ? format(new Date(i.issue_date), "dd/MM/yyyy") : "-" },
    { header: "Élève", accessorKey: "student", cell: (i: any) => `${i.student?.first_name} ${i.student?.last_name}` },
    { header: "Matricule", accessorKey: "matricule", cell: (i: any) => i.student?.matricule || "-" },
    { header: "Total", accessorKey: "total_amount", cell: (i: any) => formatAmount(i.total_amount) },
    { header: "Payé", accessorKey: "paid_amount", cell: (i: any) => formatAmount(i.paid_amount) },
    { header: "Reste", accessorKey: "balance", cell: (i: any) => formatAmount(i.balance) },
    { header: "Statut", accessorKey: "status", cell: (i: any) => getStatusLabel(i.status) },
  ];

  // Invoice generation dialog state
  const [isGenOpen, setIsGenOpen] = useState(false);
  const [genStudentId, setGenStudentId] = useState("");
  const [genClassId, setGenClassId] = useState("");
  const [genYearId, setGenYearId] = useState(activeAcademicYear?.id || "");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateInvoice = async () => {
    if (!businessId || !genStudentId || !genClassId || !genYearId) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setIsGenerating(true);
    try {
      const { data: invoiceNum, error: rpcError } = await supabase.rpc('generate_school_invoice_number', {
        p_business_id: businessId,
      });
      if (rpcError) throw rpcError;

      const classFees = fees.filter(f => f.class_id === genClassId && f.academic_year_id === genYearId);
      const totalAmount = classFees.reduce((sum, f) => sum + Number(f.amount), 0);

      const { data: invoice, error: invError } = await supabase
        .from("school_invoices")
        .insert([{
          business_id: businessId,
          student_id: genStudentId,
          academic_year_id: genYearId,
          invoice_number: invoiceNum,
          total_amount: totalAmount,
          paid_amount: 0,
          balance: totalAmount,
          status: 'pending',
          issue_date: new Date().toISOString(),
        }])
        .select()
        .single();
      if (invError) throw invError;

      if (classFees.length > 0) {
        const items = classFees.map((f: any) => ({
          invoice_id: invoice.id,
          fee_id: f.id,
          business_id: businessId,
          description: `Frais: ${f.category?.name || 'Scolarité'}`,
          amount: f.amount,
        }));
        await supabase.from("school_invoice_items").insert(items);
      }

      toast.success(`Facture ${invoiceNum} générée avec succès`);
      setIsGenOpen(false);
      setGenStudentId(""); setGenClassId("");
      loadData();
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

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
          
          <Dialog open={isGenOpen} onOpenChange={setIsGenOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Générer une Facture</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Générer une facture</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Élève</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={genStudentId} onChange={e => setGenStudentId(e.target.value)}>
                    <option value="">Sélectionner</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name} {s.matricule ? `(${s.matricule})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Classe (pour les frais)</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={genClassId} onChange={e => setGenClassId(e.target.value)}>
                    <option value="">Sélectionner</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Année académique</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={genYearId} onChange={e => setGenYearId(e.target.value)}>
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name} {y.active ? "(Active)" : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsGenOpen(false)}>Annuler</Button>
                  <Button onClick={handleGenerateInvoice} disabled={isGenerating}>
                    {isGenerating ? "Génération..." : "Générer la facture"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
          <div className="p-4 border-b flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher une facture ou un élève..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ExportButtons 
              data={filteredInvoices} 
              columns={exportColumns} 
              title="Liste des Factures" 
              schoolSettings={settings}
              academicYearName={activeAcademicYear?.name || null}
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
                        <Button variant="ghost" size="icon" title="Voir la fiche financière" onClick={() => navigate('/school/finance/student')}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-success" title="Encaisser un paiement" onClick={() => navigate('/school/payments')}>
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
