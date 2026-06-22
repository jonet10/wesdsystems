import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Wallet, Receipt, CheckCircle, Printer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ExportButtons } from "@/components/school/ExportButtons";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { supabase } from "@/lib/supabase";
import { printUnifiedReceipt } from "@/components/printing/receipt-engine";
import { ReceiptData } from "@/components/printing/ReceiptTemplate";
import { paymentService, setBusinessId } from "@/modules/school/services";
import type { SchoolInvoice, SchoolPayment, SchoolStudent, SchoolPaymentPlan } from "@/modules/school/types";
import { format } from "date-fns";

export default function SchoolPayments() {
  const { user, profile, isAuthenticated } = useAuth();
  const { settings, activeAcademicYear } = useSchoolSettings();
  const { format: formatAmount, currencyCode } = useCurrency();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  useEffect(() => {
    if (businessId) setBusinessId(businessId);
  }, [businessId]);

  const [invoices, setInvoices] = useState<SchoolInvoice[]>([]);
  const [payments, setPayments] = useState<SchoolPayment[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Payment Plans
  const [paymentPlans, setPaymentPlans] = useState<SchoolPaymentPlan[]>([]);

  // Payment Form
  const [selectedInvoice, setSelectedInvoice] = useState<SchoolInvoice | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = async () => {
    if (!businessId) return;
    try {
      setIsLoading(true);
      const [invRes, payRes] = await Promise.all([
        supabase
          .from("school_invoices")
          .select("*, student:student_id(*)")
          .eq("business_id", businessId)
          .neq("status", "paid") // Only show unpaid or partially paid invoices
          .order("created_at", { ascending: false }),
        supabase
          .from("school_payments")
          .select("*, invoice:invoice_id(*, student:student_id(*))")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(20)
      ]);

      if (invRes.error) throw invRes.error;
      if (payRes.error) throw payRes.error;

      setInvoices(invRes.data || []);
      setPayments(payRes.data || []);
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, businessId]);

  const loadPaymentPlans = async (invoiceId: string) => {
    const { data, error } = await supabase
      .from("school_payment_plans")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("due_date");
    if (error) return;
    setPaymentPlans(data || []);
  };

  // New plan form
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [newPlanAmount, setNewPlanAmount] = useState("");
  const [newPlanDueDate, setNewPlanDueDate] = useState("");

  const resetNewPlan = () => {
    setShowNewPlan(false);
    setNewPlanTitle("");
    setNewPlanAmount("");
    setNewPlanDueDate("");
  };

  const handleAddPlan = async () => {
    if (!selectedInvoice || !newPlanTitle.trim() || !newPlanAmount) {
      toast.error("Titre et montant requis");
      return;
    }
    const amount = parseFloat(newPlanAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) { toast.error("Montant invalide"); return; }
    try {
      const { error } = await supabase.from("school_payment_plans").insert([{
        invoice_id: selectedInvoice.id,
        business_id: businessId,
        title: newPlanTitle.trim(),
        amount_due: amount,
        amount_paid: 0,
        balance: amount,
        due_date: newPlanDueDate || null,
        status: "pending",
      }]);
      if (error) throw error;
      toast.success("Versement ajouté");
      resetNewPlan();
      loadPaymentPlans(selectedInvoice.id);
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    }
  };

  const sanitizeAmount = (value: string) => {
    return value.replace(/[^0-9,.]/g, "").replace(/,/g, ".");
  };

  const handlePay = (inv: SchoolInvoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.balance.toString());
    setPaymentMethod("Cash");
    setReference("");
    setSelectedPlanId("");
    setShowNewPlan(false);
    loadPaymentPlans(inv.id);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !businessId) return;

    const amount = parseFloat(paymentAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Veuillez entrer un montant valide");
      return;
    }
    if (amount > selectedInvoice.balance) {
      toast.error("Le montant dépasse le solde restant");
      return;
    }

    setIsProcessing(true);
    try {
      const newPayment = await paymentService.recordPayment({
        invoice_id: selectedInvoice.id,
        payment_plan_id: selectedPlanId || undefined,
        amount,
        payment_method: paymentMethod,
        reference: reference || undefined,
        created_by: user?.id,
      });

      toast.success("Paiement enregistré avec succès");
      setSelectedInvoice(null);
      await loadData();
      
      try {
        const fullPayment = await paymentService.getById(newPayment.id);
        handlePrintReceipt(fullPayment);
      } catch (err) {
        console.error("Impossible de charger le reçu", err);
      }
    } catch (error: any) {
      toast.error("Erreur lors du paiement", { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = (payment: SchoolPayment) => {
    const student = payment.invoice?.student;
    
    const data: ReceiptData = {
      business: {
        name: settings?.name || "ÉCOLE / INSTITUTION",
        logo_url: settings?.logo_url,
        address: settings?.address,
        phone: settings?.phone,
        email: settings?.email,
        receipt_footer_message: "Merci de votre paiement.",
        receipt_policy_message: "Veuillez conserver ce reçu."
      },
      transaction: {
        invoiceNumber: payment.receipt_number,
        invoiceLabel: "N° Reçu",
        date: payment.payment_date,
        cashierName: user?.user_metadata?.name || "Admin",
        clientName: `${student?.first_name} ${student?.last_name}`,
        clientLabel: "Élève",
        cashRegister: "CAISSE SCOLARITÉ"
      },
      items: [{
        name: payment.payment_plan?.title ? `${payment.payment_plan.title} - Facture ${payment.invoice?.invoice_number}` : `Paiement - Facture ${payment.invoice?.invoice_number}`,
        quantity: 1,
        price: payment.amount,
        total: payment.amount
      }],
      totals: {
        subtotal: payment.amount,
        total: payment.amount
      },
      payment: {
        method: payment.payment_method.toLowerCase() === "cash" ? "ESPÈCES" :
                payment.payment_method.toLowerCase() === "carte bancaire" || payment.payment_method.toLowerCase() === "card" ? "CARTE" :
                payment.payment_method.toLowerCase() === "moncash" ? "MONCASH" :
                payment.payment_method.toLowerCase() === "natcash" ? "NATCASH" :
                payment.payment_method.toLowerCase() === "chèque" ? "CHÈQUE" :
                payment.payment_method.toLowerCase() === "virement" ? "VIREMENT" : "AUTRE",
        amountReceived: payment.amount,
        balanceRemaining: payment.invoice?.balance
      },
      currencyCode: currencyCode
    };

    printUnifiedReceipt(data, formatAmount);
  };

  const filteredInvoices = invoices.filter(inv => {
    const studentName = `${inv.student?.first_name} ${inv.student?.last_name}`.toLowerCase();
    const matricule = (inv.student?.matricule || "").toLowerCase();
    const invoiceNumber = (inv.invoice_number || "").toLowerCase();
    const s = search.toLowerCase();
    return studentName.includes(s) || matricule.includes(s) || invoiceNumber.includes(s);
  });

  const [searchHistory, setSearchHistory] = useState("");

  const filteredPayments = payments.filter(pay => {
    const term = searchHistory.toLowerCase();
    const studentName = `${pay.invoice?.student?.first_name} ${pay.invoice?.student?.last_name}`.toLowerCase();
    const invoiceNumber = (pay.invoice?.invoice_number || "").toLowerCase();
    const receiptNum = (pay.receipt_number || "").toLowerCase();
    return studentName.includes(term) || invoiceNumber.includes(term) || receiptNum.includes(term);
  });

  const exportColumns = [
    { header: "N° Reçu", accessorKey: "receipt_number" },
    { header: "Date", accessorKey: "payment_date", cell: (p: any) => format(new Date(p.payment_date), "dd/MM/yyyy HH:mm") },
    { header: "Élève", accessorKey: "student", cell: (p: any) => `${p.invoice?.student?.first_name} ${p.invoice?.student?.last_name}` },
    { header: "N° Facture", accessorKey: "invoice", cell: (p: any) => p.invoice?.invoice_number },
    { header: "Méthode", accessorKey: "payment_method" },
    { header: "Montant", accessorKey: "amount", cell: (p: any) => formatAmount(p.amount) },
  ];

  return (
    <DashboardLayout role="salon_admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caisse & Encaissements</h1>
          <p className="text-muted-foreground">
            Enregistrez les paiements des élèves et imprimez les reçus
          </p>
        </div>

        <Tabs defaultValue="encaisser" className="space-y-6">
          <TabsList>
            <TabsTrigger value="encaisser">Encaisser un paiement</TabsTrigger>
            <TabsTrigger value="historique">Historique des Reçus</TabsTrigger>
          </TabsList>

          <TabsContent value="encaisser">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Area: Pending Invoices to Pay */}
          <Card className="lg:col-span-2 flex flex-col h-[600px]">
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-center">
                <CardTitle>Factures en attente de paiement</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Chercher un élève..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Solde Dû</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8">Chargement...</TableCell></TableRow>
                  ) : filteredInvoices.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune facture en attente</TableCell></TableRow>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="font-medium">{inv.invoice_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {inv.status === 'partial' ? 'Paiement partiel' : 'Non payé'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{inv.student?.first_name} {inv.student?.last_name}</div>
                        </TableCell>
                        <TableCell className="font-bold text-destructive">
                          {formatAmount(inv.balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => handlePay(inv)}>
                            Encaisser
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Right Sidebar: Recent Payments */}
          <Card className="flex flex-col h-[600px] bg-muted/20">
            <CardHeader className="pb-3 border-b bg-background">
              <CardTitle className="text-base flex items-center">
                <Receipt className="h-4 w-4 mr-2" />
                Derniers Reçus
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 space-y-4">
              {isLoading ? (
                <div className="text-center text-sm text-muted-foreground">Chargement...</div>
              ) : payments.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground">Aucun paiement récent</div>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="bg-background border rounded-lg p-3 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm">{payment.receipt_number}</div>
                        <div className="text-xs text-muted-foreground">{payment.invoice?.student?.first_name} {payment.invoice?.student?.last_name}</div>
                      </div>
                      <div className="font-bold text-success text-sm">+{formatAmount(payment.amount)}</div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{payment.payment_method}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handlePrintReceipt(payment)} title="Imprimer le reçu">
                        <Printer className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
            </div>
          </TabsContent>

          <TabsContent value="historique" className="space-y-4">
            <Card>
              <div className="p-4 border-b flex flex-col md:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher (Reçu, Élève, Facture)..." 
                    value={searchHistory}
                    onChange={(e) => setSearchHistory(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ExportButtons 
                  data={filteredPayments} 
                  columns={exportColumns} 
                  title="Historique des Paiements" 
                  schoolSettings={settings}
                  academicYearName={activeAcademicYear?.name || null}
                />
              </div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Reçu</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead>Facture</TableHead>
                      <TableHead>Méthode</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8">Aucun paiement trouvé</TableCell></TableRow>
                    ) : (
                      filteredPayments.map(payment => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.receipt_number}</TableCell>
                          <TableCell className="text-muted-foreground">{format(new Date(payment.payment_date), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell>{payment.invoice?.student?.first_name} {payment.invoice?.student?.last_name}</TableCell>
                          <TableCell className="text-muted-foreground">{payment.invoice?.invoice_number}</TableCell>
                          <TableCell><span className="text-xs bg-muted px-2 py-1 rounded-full">{payment.payment_method}</span></TableCell>
                          <TableCell className="text-right font-bold text-success">+{formatAmount(payment.amount)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handlePrintReceipt(payment)} title="Imprimer le reçu">
                              <Printer className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => { if (!open) { setSelectedInvoice(null); resetNewPlan(); }}}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Encaisser un paiement
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <form onSubmit={submitPayment} className="space-y-4 pt-4">
              <div className="bg-muted p-4 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Élève</span>
                  <span className="font-medium">{selectedInvoice.student?.first_name} {selectedInvoice.student?.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">N° Facture</span>
                  <span className="font-medium">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t">
                  <span className="font-semibold text-destructive">Solde restant à payer</span>
                  <span className="font-bold text-destructive">{formatAmount(selectedInvoice.balance)}</span>
                </div>
              </div>

              {/* Payment Plans / Versements */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Versements programmés</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewPlan(!showNewPlan)}>
                    {showNewPlan ? "Annuler" : "+ Ajouter un versement"}
                  </Button>
                </div>

                {paymentPlans.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {paymentPlans.map(plan => {
                      const remaining = plan.balance;
                      const isSelected = selectedPlanId === plan.id;
                      return (
                        <label
                          key={plan.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentPlan"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedPlanId(plan.id);
                              setPaymentAmount(remaining.toString());
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{plan.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {plan.due_date && <span>Échéance: {format(new Date(plan.due_date), "dd/MM/yyyy")} · </span>}
                              Total: {formatAmount(plan.amount_due)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-sm">{formatAmount(remaining)}</div>
                            <div className="text-xs text-muted-foreground">reste</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {paymentPlans.length === 0 && !showNewPlan && (
                  <p className="text-xs text-muted-foreground">Aucun versement programmé.</p>
                )}

                {/* New plan form */}
                {showNewPlan && (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <p className="text-sm font-medium">Nouveau versement</p>
                    <div className="space-y-2">
                      <Label className="text-xs">Titre</Label>
                      <Input value={newPlanTitle} onChange={e => setNewPlanTitle(e.target.value)} placeholder="Ex: 1ère tranche, 2ème versement..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Montant ({currencyCode})</Label>
                        <Input value={newPlanAmount} onChange={e => setNewPlanAmount(sanitizeAmount(e.target.value))} placeholder="0.00" inputMode="decimal" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Date d'échéance</Label>
                        <Input type="date" value={newPlanDueDate} onChange={e => setNewPlanDueDate(e.target.value)} />
                      </div>
                    </div>
                    <Button type="button" size="sm" onClick={handleAddPlan} className="w-full">
                      Ajouter ce versement
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Montant à encaisser ({currencyCode})</Label>
                <Input 
                  inputMode="decimal"
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(sanitizeAmount(e.target.value))} 
                  required 
                  autoFocus
                  className="text-lg font-bold"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Méthode de paiement</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Cash">Espèces (Cash)</option>
                  <option value="MonCash">MonCash</option>
                  <option value="NatCash">NatCash</option>
                  <option value="Virement">Virement Bancaire</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Carte bancaire">Carte Bancaire</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Référence (Optionnel)</Label>
                <Input 
                  placeholder="N° Chèque, Référence MonCash..." 
                  value={reference} 
                  onChange={(e) => setReference(e.target.value)} 
                />
              </div>

              <div className="flex justify-end pt-4 gap-2">
                <Button type="button" variant="outline" onClick={() => { setSelectedInvoice(null); resetNewPlan(); }}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isProcessing}>
                  {isProcessing ? "Traitement..." : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Valider l'encaissement
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
