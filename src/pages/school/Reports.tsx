import { useTranslation } from "react-i18next";
import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, PieChart, TrendingUp, Printer, Search, Calendar, DollarSign, Users, BookOpen, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { supabase } from "@/lib/supabase";
import { reportService, type PaymentReportRow, type OutstandingReportRow, type ExpenseReportRow } from "@/modules/school/services/reportService";
import { classService } from "@/modules/school/services";
import { exportToPDF, printDocument, type ExportColumn } from "@/lib/school-export";
import { format } from "date-fns";
import { setBusinessId } from "@/modules/school/services";

export default function SchoolReports() {
  const { t } = useTranslation();
  const { user, profile, isAuthenticated } = useAuth();
  const { format: formatAmount } = useCurrency();
  const { settings, activeAcademicYear } = useSchoolSettings();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;
  const userName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || user?.email || "Système";

  if (businessId) setBusinessId(businessId);

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [payments, setPayments] = useState<PaymentReportRow[]>([]);
  const [enrollmentPayments, setEnrollmentPayments] = useState<PaymentReportRow[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingReportRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseReportRow[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [classList, setClassList] = useState<any[]>([]);

  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (businessId) {
      classService.getAll().then(setClasses).catch(() => {});
    }
  }, [businessId]);

  const loadPaymentReport = async () => {
    setIsLoading(true);
    try {
      const data = await reportService.getPaymentReport(dateStart || undefined, dateEnd || undefined);
      setPayments(data);
      toast.success(`${data.length} paiements trouvés`);
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally { setIsLoading(false); }
  };

  const loadEnrollmentReport = async () => {
    setIsLoading(true);
    try {
      const data = await reportService.getEnrollmentPaymentReport(dateStart || undefined, dateEnd || undefined);
      setEnrollmentPayments(data);
      toast.success(`${data.length} paiements d'inscription trouvés`);
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally { setIsLoading(false); }
  };

  const [outstandingClassId, setOutstandingClassId] = useState("");
  const [outstandingStatus, setOutstandingStatus] = useState("all");

  const loadOutstandingReport = async () => {
    setIsLoading(true);
    try {
      const data = await reportService.getOutstandingReport(
        outstandingClassId || undefined,
        outstandingStatus
      );
      setOutstanding(data);
      toast.success(`${data.length} factures trouvées`);
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally { setIsLoading(false); }
  };

  const loadExpenseReport = async () => {
    setIsLoading(true);
    try {
      const data = await reportService.getExpenseReport(dateStart || undefined, dateEnd || undefined);
      setExpenses(data);
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally { setIsLoading(false); }
  };

  const loadComparison = async () => {
    setIsLoading(true);
    try {
      const data = await reportService.getRevenueExpenseComparison(dateStart || undefined, dateEnd || undefined);
      setComparison(data);
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally { setIsLoading(false); }
  };

  const loadClassList = async () => {
    if (!selectedClassId) { toast.error("Veuillez sélectionner une classe"); return; }
    setIsLoading(true);
    try {
      const data = await reportService.getClassList(selectedClassId);
      setClassList(data);
      const cls = classes.find(c => c.id === selectedClassId);
      toast.success(`Liste de ${cls?.name || "classe"} générée (${data.length} élèves)`);
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally { setIsLoading(false); }
  };

  const paymentColumns: ExportColumn[] = [
    { header: "Date", accessorKey: "date" },
    { header: "N° Reçu", accessorKey: "receipt_number" },
    { header: "Élève", accessorKey: "student_name" },
    { header: "Facture", accessorKey: "invoice_number" },
    { header: "Méthode", accessorKey: "payment_method" },
    { header: "Montant", accessorKey: "amount", cell: (r: any) => formatAmount(r.amount) },
  ];

  const outstandingColumns: ExportColumn[] = [
    { header: "Élève", accessorKey: "student_name" },
    { header: "Matricule", accessorKey: "matricule" },
    { header: "Classe", accessorKey: "class_name" },
    { header: "Facture", accessorKey: "invoice_number" },
    { header: "Total", accessorKey: "total_amount", cell: (r: any) => formatAmount(r.total_amount) },
    { header: "Payé", accessorKey: "paid_amount", cell: (r: any) => formatAmount(r.paid_amount) },
    { header: "Solde", accessorKey: "balance", cell: (r: any) => formatAmount(r.balance) },
  ];

  const expenseColumns: ExportColumn[] = [
    { header: "Date", accessorKey: "date" },
    { header: "Catégorie", accessorKey: "category" },
    { header: "Description", accessorKey: "description" },
    { header: "Montant", accessorKey: "amount", cell: (r: any) => formatAmount(r.amount) },
  ];

  // Column selection for class list
  const allClassColumns = [
    { key: "numero", header: "N°", accessor: "numero" as const },
    { key: "matricule", header: "Matricule", accessor: "matricule" as const },
    { key: "nom_complet", header: "Nom complet", accessor: "nom_complet" as const },
    { key: "sexe", header: "Sexe", accessor: "sexe" as const },
    { key: "telephone_parent", header: "Téléphone parent", accessor: "telephone_parent" as const },
    { key: "date_naissance", header: "Date naissance", accessor: "date_naissance" as const },
    { key: "adresse", header: "Adresse", accessor: "adresse" as const },
  ];
  const [selectedColumns, setSelectedColumns] = useState<string[]>(["numero", "nom_complet", "sexe"]);

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const buildClassListColumns = (): ExportColumn[] => {
    return allClassColumns
      .filter(c => selectedColumns.includes(c.key))
      .map(c => ({ header: c.header, accessorKey: c.accessor }));
  };

  const getFooterSummary = () => {
    const girls = classList.filter((s: any) => s.sexe === "F").length;
    const boys = classList.filter((s: any) => s.sexe === "M").length;
    return `Nombre d'élèves: ${classList.length}  |  Filles: ${girls}  |  Garçons: ${boys}`;
  };

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports & Analyses</h1>
          <p className="text-muted-foreground">Générez des rapports financiers et administratifs</p>
        </div>

        <Tabs defaultValue="payments" className="space-y-6">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent overflow-x-auto">
            <TabsTrigger value="payments" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">
              <DollarSign className="h-4 w-4 mr-2" />Paiements (Général)
            </TabsTrigger>
            <TabsTrigger value="enrollments" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">
              <GraduationCap className="h-4 w-4 mr-2" />Recettes Inscriptions
            </TabsTrigger>
            <TabsTrigger value="outstanding" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">
              <TrendingUp className="h-4 w-4 mr-2" />Impayés
            </TabsTrigger>
            <TabsTrigger value="expenses" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">
              <FileText className="h-4 w-4 mr-2" />Dépenses
            </TabsTrigger>
            <TabsTrigger value="comparison" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">
              <PieChart className="h-4 w-4 mr-2" />Revenus vs Dépenses
            </TabsTrigger>
            <TabsTrigger value="classlist" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3">
              <BookOpen className="h-4 w-4 mr-2" />Liste de Classe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Date début</Label>
                  <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 w-44" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date fin</Label>
                  <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 w-44" />
                </div>
                <Button onClick={loadPaymentReport} disabled={isLoading} size="sm">
                  <Search className="h-4 w-4 mr-2" />Générer
                </Button>
              </CardContent>
            </Card>
            {payments.length > 0 && (
              <Card>
                <div className="p-4 border-b flex justify-between items-center">
                  <div className="font-medium">{payments.length} paiements · Total: {formatAmount(payments.reduce((s, r) => s + r.amount, 0))}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => printDocument("Rapport des Paiements", payments, paymentColumns, settings, activeAcademicYear?.name || null, userName)}>
                      <Printer className="h-4 w-4 mr-2" />Imprimer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportToPDF("Rapport des Paiements", payments, paymentColumns, settings, activeAcademicYear?.name || null, userName)}>
                      <Download className="h-4 w-4 mr-2" />PDF
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0 max-h-96 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>N° Reçu</TableHead>
                        <TableHead>Élève</TableHead>
                        <TableHead>Méthode</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{r.date}</TableCell>
                          <TableCell className="font-medium">{r.receipt_number}</TableCell>
                          <TableCell>{r.student_name}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell className="text-right font-medium text-success">+{formatAmount(r.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="enrollments" className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Date début</Label>
                  <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 w-44" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date fin</Label>
                  <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 w-44" />
                </div>
                <Button onClick={loadEnrollmentReport} disabled={isLoading} size="sm">
                  <Search className="h-4 w-4 mr-2" />Générer
                </Button>
              </CardContent>
            </Card>
            {enrollmentPayments.length > 0 ? (
              <Card>
                <div className="p-4 border-b flex justify-between items-center">
                  <div className="font-medium">{enrollmentPayments.length} paiements d'inscription · Total: {formatAmount(enrollmentPayments.reduce((s, r) => s + r.amount, 0))}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => printDocument("Rapport des Inscriptions", enrollmentPayments, paymentColumns, settings, activeAcademicYear?.name || null, userName)}>
                      <Printer className="h-4 w-4 mr-2" />Imprimer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportToPDF("Rapport des Inscriptions", enrollmentPayments, paymentColumns, settings, activeAcademicYear?.name || null, userName)}>
                      <Download className="h-4 w-4 mr-2" />PDF
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0 max-h-96 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>N° Reçu</TableHead>
                        <TableHead>Élève</TableHead>
                        <TableHead>Méthode</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollmentPayments.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{r.date}</TableCell>
                          <TableCell className="font-medium">{r.receipt_number}</TableCell>
                          <TableCell>{r.student_name}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell className="text-right font-medium text-success">+{formatAmount(r.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : !isLoading && (
              <Card className="p-8 text-center text-muted-foreground">
                Aucun paiement d'inscription trouvé pour la période sélectionnée.
              </Card>
            )}
          </TabsContent>

          <TabsContent value="outstanding" className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                <div className="space-y-1 min-w-[200px]">
                  <Label className="text-xs">Filtrer par classe</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={outstandingClassId} onChange={e => setOutstandingClassId(e.target.value)}>
                    <option value="">Toutes les classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 min-w-[180px]">
                  <Label className="text-xs">Statut de paiement</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={outstandingStatus} onChange={e => setOutstandingStatus(e.target.value)}>
                    <option value="all">Tous les statuts</option>
                    <option value="pending">Non payé</option>
                    <option value="partial">Paiement partiel</option>
                  </select>
                </div>
                <Button onClick={loadOutstandingReport} disabled={isLoading} size="sm">
                  <Search className="h-4 w-4 mr-2" />Générer
                </Button>
              </CardContent>
            </Card>
            {outstanding.length > 0 && (
              <Card>
                <div className="p-4 border-b flex justify-between items-center flex-wrap gap-2">
                  <div className="font-medium">{outstanding.length} factures impayées</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => printDocument("Liste des Impayés", outstanding, outstandingColumns, settings, activeAcademicYear?.name || null, userName,
                      `Total: ${formatAmount(outstanding.reduce((s, r) => s + r.total_amount, 0))}  |  Payé: ${formatAmount(outstanding.reduce((s, r) => s + r.paid_amount, 0))}  |  Solde total dû: ${formatAmount(outstanding.reduce((s, r) => s + r.balance, 0))}`
                    )}>
                      <Printer className="h-4 w-4 mr-2" />Imprimer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportToPDF("Liste des Impayés", outstanding, outstandingColumns, settings, activeAcademicYear?.name || null, userName,
                      `Total: ${formatAmount(outstanding.reduce((s, r) => s + r.total_amount, 0))}  |  Payé: ${formatAmount(outstanding.reduce((s, r) => s + r.paid_amount, 0))}  |  Solde total dû: ${formatAmount(outstanding.reduce((s, r) => s + r.balance, 0))}`
                    )}>
                      <Download className="h-4 w-4 mr-2" />PDF
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0 max-h-96 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Élève</TableHead>
                        <TableHead>Facture</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Payé</TableHead>
                        <TableHead className="text-right">Solde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstanding.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.student_name}</TableCell>
                          <TableCell>{r.invoice_number}</TableCell>
                          <TableCell>{formatAmount(r.total_amount)}</TableCell>
                          <TableCell className="text-success">{formatAmount(r.paid_amount)}</TableCell>
                          <TableCell className="text-right font-bold text-destructive">{formatAmount(r.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-3 border-t bg-muted/30 text-sm font-medium text-center">
                    Total: {formatAmount(outstanding.reduce((s, r) => s + r.total_amount, 0))} &nbsp;|&nbsp; Payé: {formatAmount(outstanding.reduce((s, r) => s + r.paid_amount, 0))} &nbsp;|&nbsp; Solde total dû: {formatAmount(outstanding.reduce((s, r) => s + r.balance, 0))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Date début</Label>
                  <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 w-44" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date fin</Label>
                  <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 w-44" />
                </div>
                <Button onClick={loadExpenseReport} disabled={isLoading} size="sm">
                  <Search className="h-4 w-4 mr-2" />Générer
                </Button>
              </CardContent>
            </Card>
            {expenses.length > 0 && (
              <Card>
                <div className="p-4 border-b flex justify-between items-center">
                  <div className="font-medium">{expenses.length} dépenses · Total: {formatAmount(expenses.reduce((s, r) => s + r.amount, 0))}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => printDocument("Rapport des Dépenses", expenses, expenseColumns, settings, activeAcademicYear?.name || null, userName)}>
                      <Printer className="h-4 w-4 mr-2" />Imprimer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportToPDF("Rapport des Dépenses", expenses, expenseColumns, settings, activeAcademicYear?.name || null, userName)}>
                      <Download className="h-4 w-4 mr-2" />PDF
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0 max-h-96 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>{t("common.category")}</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{r.date}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell className="text-muted-foreground">{r.description}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">{formatAmount(r.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Date début</Label>
                  <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 w-44" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date fin</Label>
                  <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 w-44" />
                </div>
                <Button onClick={loadComparison} disabled={isLoading} size="sm">
                  <Search className="h-4 w-4 mr-2" />Analyser
                </Button>
              </CardContent>
            </Card>
            {comparison && (
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-6 text-center">
                    <DollarSign className="h-8 w-8 mx-auto text-success mb-2" />
                    <div className="text-sm text-muted-foreground">Revenus</div>
                    <div className="text-3xl font-bold text-success">{formatAmount(comparison.totalRevenue)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{comparison.revenueCount} transactions</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <TrendingUp className="h-8 w-8 mx-auto text-destructive mb-2" />
                    <div className="text-sm text-muted-foreground">Dépenses</div>
                    <div className="text-3xl font-bold text-destructive">{formatAmount(comparison.totalExpenses)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{comparison.expenseCount} transactions</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <PieChart className="h-8 w-8 mx-auto mb-2" style={{ color: comparison.profit >= 0 ? "var(--success)" : "var(--destructive)" }} />
                    <div className="text-sm text-muted-foreground">Bénéfice Net</div>
                    <div className={`text-3xl font-bold ${comparison.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatAmount(Math.abs(comparison.profit))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{comparison.profit >= 0 ? "Bénéfice" : "Perte"}</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="classlist" className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1 min-w-[250px]">
                    <Label className="text-xs">Sélectionner une classe</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                      <option value="">-- Choisir une classe --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={loadClassList} disabled={isLoading || !selectedClassId} size="sm">
                    <Search className="h-4 w-4 mr-2" />Générer
                  </Button>
                </div>
                <div>
                  <Label className="text-xs block mb-2">Colonnes à afficher</Label>
                  <div className="flex flex-wrap gap-3">
                    {allClassColumns.map(col => (
                      <label key={col.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          className="h-4 w-4"
                        />
                        {col.header}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            {classList.length > 0 && (
              <Card>
                <div className="p-4 border-b flex justify-between items-center flex-wrap gap-2">
                  <div className="font-medium">{getFooterSummary()}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => printDocument(
                      `Liste de Classe - ${classes.find(c => c.id === selectedClassId)?.name || ""}`,
                      classList, buildClassListColumns(), settings, activeAcademicYear?.name || null, userName, getFooterSummary()
                    )}>
                      <Printer className="h-4 w-4 mr-2" />Imprimer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportToPDF(
                      `Liste de Classe - ${classes.find(c => c.id === selectedClassId)?.name || ""}`,
                      classList, buildClassListColumns(), settings, activeAcademicYear?.name || null, userName, getFooterSummary()
                    )}>
                      <Download className="h-4 w-4 mr-2" />PDF
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {buildClassListColumns().map(col => (
                          <TableHead key={col.accessorKey}>{col.header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classList.map((s: any, i: number) => (
                        <TableRow key={i}>
                          {buildClassListColumns().map(col => (
                            <TableCell key={col.accessorKey}>
                              {col.cell ? col.cell(s) : String(s[col.accessorKey] || "-")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-3 border-t bg-muted/30 text-sm font-medium text-center">
                    {getFooterSummary()}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
