import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Download, Printer, FileText, Wallet, CreditCard, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { exportToPDF, printDocument, type ExportColumn } from "@/lib/school-export";

export default function StudentFinancialSheet() {
  const { user, profile, isAuthenticated } = useAuth();
  const { format: formatAmount } = useCurrency();
  const { settings, activeAcademicYear } = useSchoolSettings();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadStudents = async () => {
    if (!businessId) return;
    const { data } = await supabase
      .from("school_students")
      .select("*")
      .eq("business_id", businessId)
      .order("last_name");
    if (data) setStudents(data);
  };

  useEffect(() => {
    if (isAuthenticated) loadStudents();
  }, [isAuthenticated, businessId]);

  const loadStudentFinance = async (student: any) => {
    if (!businessId) return;
    setIsLoading(true);
    setSelectedStudent(student);
    try {
      const { data: invData, error: invErr } = await supabase
        .from("school_invoices")
        .select("*, academic_year:academic_year_id(*)")
        .eq("business_id", businessId)
        .eq("student_id", student.id)
        .order("created_at", { ascending: false });
      if (invErr) throw invErr;
      setInvoices(invData || []);

      if (invData?.length) {
        const invoiceIds = invData.map(i => i.id);
        const [payRes, planRes] = await Promise.all([
          supabase.from("school_payments")
            .select("*, invoice:invoice_id(*)")
            .eq("business_id", businessId)
            .in("invoice_id", invoiceIds)
            .order("created_at", { ascending: false }),
          supabase.from("school_payment_plans")
            .select("*")
            .in("invoice_id", invoiceIds)
            .order("due_date"),
        ]);
        if (payRes.data) setPayments(payRes.data);
        if (planRes.data) setPaymentPlans(planRes.data);
      } else {
        setPayments([]);
        setPaymentPlans([]);
      }
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const totalBilled = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paid_amount), 0);
  const totalBalance = invoices.reduce((s, i) => s + Number(i.balance), 0);

  const filteredStudents = students.filter(s =>
    `${s.first_name} ${s.last_name} ${s.matricule || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const exportColumns: ExportColumn[] = [
    { header: "Facture", accessorKey: "invoice_number" },
    { header: "Année", accessorKey: "academic_year", cell: (i: any) => i.academic_year?.name || "-" },
    { header: "Total", accessorKey: "total_amount", cell: (i: any) => formatAmount(i.total_amount) },
    { header: "Payé", accessorKey: "paid_amount", cell: (i: any) => formatAmount(i.paid_amount) },
    { header: "Solde", accessorKey: "balance", cell: (i: any) => formatAmount(i.balance) },
  ];

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fiche Financière Élève</h1>
          <p className="text-muted-foreground">Consultez la situation financière détaillée d'un élève</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Sélectionner un élève</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {filteredStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => loadStudentFinance(s)}
                    className={`w-full text-left p-3 rounded-lg transition-colors text-sm ${
                      selectedStudent?.id === s.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <div className="font-medium">{s.first_name} {s.last_name}</div>
                    <div className="text-xs text-muted-foreground">{s.class_level || "N/A"} {s.matricule ? `- ${s.matricule}` : ""}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            {!selectedStudent ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p>Sélectionnez un élève pour voir sa fiche financière</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Total Facturé</span>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="text-2xl font-bold mt-2">{formatAmount(totalBilled)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Total Payé</span>
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      </div>
                      <div className="text-2xl font-bold text-success mt-2">{formatAmount(totalPaid)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Solde Restant</span>
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      </div>
                      <div className={`text-2xl font-bold mt-2 ${totalBalance > 0 ? "text-destructive" : "text-success"}`}>
                        {formatAmount(totalBalance)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Échéancier de paiement</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Échéance</TableHead>
                          <TableHead>Montant dû</TableHead>
                          <TableHead>Payé</TableHead>
                          <TableHead>Solde</TableHead>
                          <TableHead>Date d'échéance</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentPlans.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun échéancier</TableCell></TableRow>
                        ) : (
                          paymentPlans.map(plan => (
                            <TableRow key={plan.id}>
                              <TableCell className="font-medium">{plan.title}</TableCell>
                              <TableCell>{formatAmount(plan.amount_due)}</TableCell>
                              <TableCell className="text-success">{formatAmount(plan.amount_paid)}</TableCell>
                              <TableCell className={plan.balance > 0 ? "text-destructive" : "text-success"}>{formatAmount(plan.balance)}</TableCell>
                              <TableCell>{plan.due_date ? format(new Date(plan.due_date), "dd/MM/yyyy") : "-"}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  plan.status === "paid" ? "bg-success/10 text-success" :
                                  plan.status === "partial" ? "bg-warning/10 text-warning" :
                                  plan.status === "overdue" ? "bg-destructive/10 text-destructive" :
                                  "bg-muted text-muted-foreground"
                                }`}>
                                  {plan.status === "paid" ? "Payé" : plan.status === "partial" ? "Partiel" : plan.status === "overdue" ? "En retard" : "En attente"}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Historique des factures</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => printDocument(
                        `Relevé de compte - ${selectedStudent.first_name} ${selectedStudent.last_name}`,
                        invoices, exportColumns, settings, activeAcademicYear?.name || null
                      )}>
                        <Printer className="h-4 w-4 mr-2" />Imprimer
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportToPDF(
                        `Relevé de compte - ${selectedStudent.first_name} ${selectedStudent.last_name}`,
                        invoices, exportColumns, settings, activeAcademicYear?.name || null
                      )}>
                        <Download className="h-4 w-4 mr-2" />PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>N° Facture</TableHead>
                          <TableHead>Année</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Payé</TableHead>
                          <TableHead>Solde</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-8">Aucune facture</TableCell></TableRow>
                        ) : (
                          invoices.map(inv => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                              <TableCell>{inv.academic_year?.name || "-"}</TableCell>
                              <TableCell>{formatAmount(inv.total_amount)}</TableCell>
                              <TableCell className="text-success">{formatAmount(inv.paid_amount)}</TableCell>
                              <TableCell className={inv.balance > 0 ? "text-destructive font-bold" : ""}>{formatAmount(inv.balance)}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  inv.status === "paid" ? "bg-success/10 text-success" :
                                  inv.status === "partial" ? "bg-warning/10 text-warning" :
                                  inv.status === "overdue" ? "bg-destructive/10 text-destructive" :
                                  "bg-muted text-muted-foreground"
                                }`}>{inv.status}</span>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {inv.issue_date ? format(new Date(inv.issue_date), "dd/MM/yyyy") : "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Historique des paiements</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>N° Reçu</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Facture</TableHead>
                          <TableHead>Méthode</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-8">Aucun paiement</TableCell></TableRow>
                        ) : (
                          payments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.receipt_number}</TableCell>
                              <TableCell>{format(new Date(p.payment_date), "dd/MM/yyyy HH:mm")}</TableCell>
                              <TableCell>{p.invoice?.invoice_number || "-"}</TableCell>
                              <TableCell>{p.payment_method}</TableCell>
                              <TableCell className="text-right font-bold text-success">+{formatAmount(p.amount)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
