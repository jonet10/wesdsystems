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
import { printReceipt } from "@/lib/print-utils";
import type { SchoolInvoice, SchoolPayment, SchoolStudent } from "@/modules/school/types";
import { format } from "date-fns";

export default function SchoolPayments() {
  const { user, profile, isAuthenticated } = useAuth();
  const { settings, activeAcademicYear } = useSchoolSettings();
  const { formatAmount, currencyCode } = useCurrency();
  const businessId = profile?.business_id || user?.user_metadata?.business_id;

  const [invoices, setInvoices] = useState<SchoolInvoice[]>([]);
  const [payments, setPayments] = useState<SchoolPayment[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Payment Form
  const [selectedInvoice, setSelectedInvoice] = useState<SchoolInvoice | null>(null);
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

  const handlePay = (inv: SchoolInvoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.balance.toString());
    setPaymentMethod("Cash");
    setReference("");
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !businessId) return;

    const amount = parseFloat(paymentAmount);
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
      // 1. Generate receipt number
      const { data: receiptNum, error: rpcError } = await supabase.rpc('generate_school_receipt_number', {
        p_business_id: businessId
      });
      if (rpcError) throw rpcError;

      // 2. Insert Payment
      const paymentPayload = {
        business_id: businessId,
        invoice_id: selectedInvoice.id,
        receipt_number: receiptNum,
        amount: amount,
        payment_method: paymentMethod,
        reference: reference || null,
        created_by: user?.id
      };

      const { data: newPayment, error: payError } = await supabase
        .from("school_payments")
        .insert([paymentPayload])
        .select()
        .single();
      
      if (payError) throw payError;

      // 3. Update Invoice Balance
      const newPaidAmount = Number(selectedInvoice.paid_amount) + amount;
      const newBalance = Number(selectedInvoice.balance) - amount;
      let newStatus = selectedInvoice.status;
      if (newBalance <= 0) newStatus = 'paid';
      else if (newPaidAmount > 0) newStatus = 'partial';

      const { error: updateError } = await supabase
        .from("school_invoices")
        .update({
          paid_amount: newPaidAmount,
          balance: newBalance,
          status: newStatus
        })
        .eq("id", selectedInvoice.id);

      if (updateError) throw updateError;

      toast.success("Paiement enregistré avec succès", {
        description: `Reçu N° ${receiptNum}`
      });

      setSelectedInvoice(null);
      loadData();
    } catch (error: any) {
      toast.error("Erreur lors du paiement", { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = (payment: SchoolPayment) => {
    const student = payment.invoice?.student;
    const content = `
      <div style="font-family: sans-serif; max-width: 300px; margin: 0 auto; text-align: center;">
        <h2>Reçu de Paiement</h2>
        <p style="font-size: 14px; margin: 0;">N° ${payment.receipt_number}</p>
        <p style="font-size: 12px; color: #666;">Date: ${format(new Date(payment.payment_date), "dd/MM/yyyy HH:mm")}</p>
        
        <hr style="border-top: 1px dashed #ccc; margin: 15px 0;" />
        
        <div style="text-align: left; margin-bottom: 15px;">
          <p><strong>Élève :</strong> ${student?.first_name} ${student?.last_name}</p>
          <p><strong>Facture :</strong> ${payment.invoice?.invoice_number}</p>
          <p><strong>Méthode :</strong> ${payment.payment_method}</p>
        </div>

        <hr style="border-top: 1px dashed #ccc; margin: 15px 0;" />
        
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold;">
          <span>MONTANT PAYÉ</span>
          <span>${payment.amount} ${currencyCode}</span>
        </div>

        <p style="font-size: 12px; margin-top: 30px; color: #888;">Merci pour votre paiement !</p>
      </div>
    `;
    printReceipt(content);
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

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-md">
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

              <div className="space-y-2">
                <Label>Montant à encaisser ({currencyCode})</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  max={selectedInvoice.balance}
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                  required 
                  autoFocus
                  className="text-lg font-bold"
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
                <Button type="button" variant="outline" onClick={() => setSelectedInvoice(null)}>
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
