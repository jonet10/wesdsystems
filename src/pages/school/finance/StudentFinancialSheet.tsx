import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Download, Printer, FileText, Wallet, CreditCard, ArrowUpRight, ArrowDownRight, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToPDF, printDocument, type ExportColumn } from "@/lib/school-export";

export default function StudentFinancialSheet() {
  const { t } = useTranslation();
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
  const [classes, setClasses] = useState<any[]>([]);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const loadStudents = async () => {
    if (!businessId) return;
    const [studRes, classRes] = await Promise.all([
      supabase
        .from("school_students")
        .select("*")
        .eq("business_id", businessId)
        .order("last_name"),
      supabase
        .from("school_classes")
        .select("*")
        .eq("business_id", businessId)
    ]);
    if (studRes.data) setStudents(studRes.data);
    if (classRes.data) setClasses(classRes.data);
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

  const handleGenerateInvoiceForStudent = async (student: any) => {
    if (!businessId || !activeAcademicYear) {
      toast.error("Données de session ou année active manquantes");
      return;
    }

    const cls = classes.find(c => c.code === student.class_level || c.name === student.class_level);
    if (!cls) {
      toast.error(`Classe "${student.class_level}" non trouvée ou non configurée dans les paramètres.`);
      return;
    }

    setIsGeneratingInvoice(true);
    try {
      const { data: fees, error: feesErr } = await supabase
        .from("school_fees")
        .select("*, category:category_id(*)")
        .eq("class_id", cls.id)
        .eq("academic_year_id", activeAcademicYear.id);
      
      if (feesErr) throw feesErr;

      if (!fees || fees.length === 0) {
        toast.error(`Aucun frais n'est configuré pour la classe de ${cls.name} pour l'année ${activeAcademicYear.name}.`, {
          description: "Veuillez d'abord configurer les montants par classe dans 'Frais & Tarifs'."
        });
        return;
      }

      const { data: invoiceNum, error: rpcError } = await supabase.rpc('generate_school_invoice_number', {
        p_business_id: businessId
      });
      if (rpcError) throw rpcError;

      // Separate fees: enrollment fees at full price, tuition fees discounted
      const enrollmentFeesManual = fees.filter((f: any) => f.category?.fee_type === 'enrollment');
      const tuitionFeesManual = fees.filter((f: any) => f.category?.fee_type !== 'enrollment');

      const enrollSubTotal = enrollmentFeesManual.reduce((sum: number, f: any) => sum + Number(f.amount), 0);
      const tuitionSubTotal = tuitionFeesManual.reduce((sum: number, f: any) => sum + Number(f.amount), 0);

      let discountAmount = 0;
      if (student.scholarship_percentage && student.scholarship_percentage > 0) {
        discountAmount = (tuitionSubTotal * student.scholarship_percentage) / 100;
      }

      const totalAmount = enrollSubTotal + tuitionSubTotal - discountAmount;

      const { data: invoice, error: invError } = await supabase
        .from("school_invoices")
        .insert([{
          business_id: businessId,
          student_id: student.id,
          academic_year_id: activeAcademicYear.id,
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

      // Items: all fees at original amount + one discount line for tuition if applicable
      const invoiceItems = fees.map((fee: any) => ({
        invoice_id: invoice.id,
        fee_id: fee.id,
        business_id: businessId,
        description: `Frais: ${fee.category?.name || 'Scolarité'}`,
        amount: fee.amount,
      }));

      if (discountAmount > 0) {
        invoiceItems.push({
          invoice_id: invoice.id,
          fee_id: null as any,
          business_id: businessId,
          description: `Bourse sur scolarité (${student.scholarship_percentage}%)` + (student.scholarship_note ? ` - ${student.scholarship_note}` : ''),
          amount: -discountAmount,
        });
      }

      const { error: itemsError } = await supabase
        .from("school_invoice_items")
        .insert(invoiceItems);
      if (itemsError) throw itemsError;

      const { data: template, error: tmplError } = await supabase
        .from("school_payment_templates")
        .select("*, installments:school_payment_template_installments(*)")
        .eq("class_id", cls.id)
        .eq("academic_year_id", activeAcademicYear.id)
        .maybeSingle();
      if (tmplError && tmplError.code !== 'PGRST116') throw tmplError;

      if (template?.installments?.length) {
        let plans = template.installments.map((inst: any) => {
          const rawAmount = inst.is_percentage
            ? (totalAmount * inst.percentage_or_amount) / 100
            : inst.percentage_or_amount;
          return {
            invoice_id: invoice.id,
            business_id: businessId,
            title: inst.title,
            amount_due: rawAmount,
            amount_paid: 0,
            balance: rawAmount,
            due_date: inst.due_date || null,
            status: 'pending' as const,
          };
        });

        const plansSum = plans.reduce((acc: number, p: any) => acc + Number(p.amount_due), 0);
        
        // If the template uses fixed amounts but the student has a discount, scale down the plans
        if (plansSum > totalAmount && plansSum > 0) {
          const scale = totalAmount / plansSum;
          plans = plans.map(p => ({
            ...p,
            amount_due: p.amount_due * scale,
            balance: p.amount_due * scale,
          }));
        } else if (plansSum === 0) {
          plans = plans.map(p => ({ ...p, amount_due: 0, balance: 0 }));
        }

        const actualPlansSum = plans.reduce((acc: number, p: any) => acc + Number(p.amount_due), 0);
        if (actualPlansSum < totalAmount) {
          plans.unshift({
            invoice_id: invoice.id,
            business_id: businessId,
            title: "Frais initiaux (Inscription & Autres)",
            amount_due: totalAmount - plansSum,
            amount_paid: 0,
            balance: totalAmount - plansSum,
            due_date: new Date().toISOString(),
            status: 'pending',
          });
        }

        await supabase.from("school_payment_plans").insert(plans);
      } else {
        const defaultPlan = {
          invoice_id: invoice.id,
          business_id: businessId,
          title: "Paiement unique",
          amount_due: totalAmount,
          amount_paid: 0,
          balance: totalAmount,
          status: 'pending',
        };
        await supabase.from("school_payment_plans").insert([defaultPlan]);
      }

      toast.success("Facture et échéancier de paiement générés avec succès !");
      loadStudentFinance(student);
    } catch (err: any) {
      toast.error("Erreur de génération", { description: err.message });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette facture ? Vous pourrez la regénérer ensuite pour appliquer les nouveaux tarifs ou la bourse.")) return;
    try {
      setIsLoading(true);
      const { error } = await supabase.from("school_invoices").delete().eq("id", invoiceId);
      if (error) throw error;
      toast.success("Facture supprimée avec succès.");
      if (selectedStudent) loadStudentFinance(selectedStudent);
    } catch (e: any) {
      toast.error("Erreur de suppression", { description: e.message });
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

  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const [batchClassId, setBatchClassId] = useState("all");
  const [batchFilterDebt, setBatchFilterDebt] = useState(true);

  const handleBatchPrint = async () => {
    setIsBatchPrinting(true);
    try {
      let targetStudents = students;
      if (batchClassId !== "all") {
        targetStudents = students.filter(s => s.class_level === batchClassId);
      }
      if (targetStudents.length === 0) {
        toast.error("Aucun élève trouvé dans cette classe.");
        return;
      }
      
      const { data: invData, error } = await supabase
        .from("school_invoices")
        .select("*")
        .eq("business_id", businessId)
        .in("student_id", targetStudents.map(s => s.id));
        
      if (error) throw error;
      
      const studentBalances = targetStudents.map(student => {
        const studentInvoices = invData?.filter(i => i.student_id === student.id) || [];
        const totalBilled = studentInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
        const totalPaid = studentInvoices.reduce((sum, i) => sum + Number(i.paid_amount), 0);
        const balance = studentInvoices.reduce((sum, i) => sum + Number(i.balance), 0);
        return { student, totalBilled, totalPaid, balance };
      });
      
      let finalStudents = studentBalances;
      if (batchFilterDebt) {
        finalStudents = finalStudents.filter(sb => sb.balance > 0);
      }
      
      if (finalStudents.length === 0) {
        toast.error("Aucun élève ne correspond aux critères.");
        return;
      }

      const slipsHtml = finalStudents.map((sb, idx) => `
        <div style="width: 48%; box-sizing: border-box; border: 1px dashed #000; padding: 15px; margin-bottom: 20px; page-break-inside: avoid;">
          ${settings?.logo_url ? `<div style="text-align: center;"><img src="${settings.logo_url}" style="max-height: 50px;" /></div>` : ''}
          <h3 style="text-align: center; margin: 5px 0; font-size: 14px;">${settings?.name || "ÉCOLE"}</h3>
          <h4 style="text-align: center; margin: 5px 0; color: #555; font-size: 12px;">AVIS DE PAIEMENT</h4>
          <hr style="border: 0; border-top: 1px solid #ccc; margin: 10px 0;" />
          <p style="margin: 3px 0; font-size: 13px;"><strong>Élève :</strong> ${sb.student.first_name} ${sb.student.last_name}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Classe :</strong> ${sb.student.class_level || "N/A"}</p>
          <table style="width: 100%; margin-top: 15px; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 4px 0;">Total facturé :</td><td style="text-align: right; padding: 4px 0;">${formatAmount(sb.totalBilled)}</td></tr>
            <tr><td style="padding: 4px 0;">Total payé :</td><td style="text-align: right; padding: 4px 0;">${formatAmount(sb.totalPaid)}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold; border-top: 1px solid #000;">Solde à payer :</td><td style="text-align: right; padding: 4px 0; font-weight: bold; border-top: 1px solid #000;">${formatAmount(sb.balance)}</td></tr>
          </table>
          ${sb.balance > 0 ? `<p style="font-size: 11px; text-align: center; margin-top: 15px; color: #000;">Veuillez régulariser ce solde dans les plus brefs délais.</p>` : `<p style="font-size: 11px; text-align: center; margin-top: 15px; color: #000;">En règle.</p>`}
        </div>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Avis de paiement</title>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 10px; color: #000; }
              .grid-container { display: flex; flex-wrap: wrap; justify-content: space-between; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            <div class="grid-container">
              ${slipsHtml}
            </div>
            <script>window.onload = () => window.print();</script>
          </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }

    } catch (e: any) {
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setIsBatchPrinting(false);
    }
  };

  const uniqueClasses = [...new Set(students.map(s => s.class_level).filter(Boolean))].sort();

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fiche Financière Élève</h1>
            <p className="text-muted-foreground">Consultez la situation financière détaillée d'un élève</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Printer className="h-4 w-4 mr-2"/> Générer Avis (Lot)</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Générer les avis de paiement pour une classe</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Classe</Label>
                  <Select value={batchClassId} onValueChange={setBatchClassId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez une classe" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les classes</SelectItem>
                      {uniqueClasses.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="filter-debt" 
                    checked={batchFilterDebt} 
                    onCheckedChange={(c) => setBatchFilterDebt(c as boolean)} 
                  />
                  <Label htmlFor="filter-debt" className="text-sm font-normal">
                    Ne générer que pour les élèves qui ont un solde (dette) à payer
                  </Label>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button onClick={handleBatchPrint} disabled={isBatchPrinting}>
                    {isBatchPrinting ? "Génération..." : "Imprimer les avis (2 par ligne)"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Sélectionner un élève</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("common.search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                    <div className="font-medium flex justify-between items-center">
                      <span>{s.first_name} {s.last_name}</span>
                      {s.scholarship_type === 'full' && <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full dark:bg-green-900/30 dark:text-green-400">🎓 100%</span>}
                      {s.scholarship_type === 'half' && <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full dark:bg-orange-900/30 dark:text-orange-400">🎓 50%</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{s.class_level || "N/A"} {s.matricule ? `- ${s.matricule}` : ""}</div>
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
                {invoices.length === 0 && (
                  <Card className="border-warning/30 bg-warning/5 dark:bg-warning/10 mb-6">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-warning-foreground flex items-center gap-1.5">
                          ⚠️ Facture de scolarité manquante
                        </h4>
                        <p className="text-xs text-muted-foreground font-normal">
                          Cet élève est inscrit en classe de <strong>{selectedStudent.class_level || "N/A"}</strong> mais aucune facture ni échéancier n'a été créé pour l'année en cours (possiblement inscrit avant la saisie des tarifs).
                        </p>
                      </div>
                      <Button 
                        onClick={() => handleGenerateInvoiceForStudent(selectedStudent)}
                        disabled={isGeneratingInvoice}
                        size="sm"
                        className="bg-warning text-warning-foreground hover:bg-warning/80 shrink-0 self-start sm:self-center font-medium"
                      >
                        {isGeneratingInvoice ? "Génération..." : "Générer la Facture"}
                      </Button>
                    </CardContent>
                  </Card>
                )}

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
                          <TableHead>{t("common.status")}</TableHead>
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
                          <TableHead>{t("common.status")}</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">{t("common.actions")}</TableHead>
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
                              <TableCell className="text-right">
                                {inv.paid_amount === 0 && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                                    onClick={() => handleDeleteInvoice(inv.id)}
                                    title="Supprimer la facture (utile pour appliquer une bourse et regénérer)"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
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
