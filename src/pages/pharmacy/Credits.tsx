import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { supabase } from "@/lib/supabase";
import { glowupStore } from "@/lib/store";
import { setPharmacyBusinessId, getPharmacyBusinessId } from "@/modules/pharmacy/services/productService";
import { toast } from "sonner";
import { CreditCard, DollarSign, Users, AlertTriangle, Search, CheckCircle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface CreditSale {
  id: string;
  receipt_number: string;
  total: number;
  payment_status: string;
  created_at: string;
  customer?: { first_name: string; last_name: string; phone: string | null };
  amount_paid: number;
  balance: number;
}

export default function PharmacyCredits() {
  const { format } = useCurrency();
  const [credits, setCredits] = useState<CreditSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CreditSale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    try {
      const bizId = glowupStore.getSalons()[0]?.business_id;
      if (bizId) setPharmacyBusinessId(bizId);
    } catch (e) {}
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const businessId = getPharmacyBusinessId();
      const { data, error } = await supabase
        .from("pharmacy_sales")
        .select("id, receipt_number, total, payment_status, created_at, customer:customer_id(first_name, last_name, phone)")
        .eq("business_id", businessId)
        .in("payment_status", ["credit", "partial"])
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Compute balance for each
      const withBalance = await Promise.all(
        (data || []).map(async (sale: any) => {
          const { data: payments } = await supabase
            .from("pharmacy_credit_payments")
            .select("amount")
            .eq("sale_id", sale.id);
          const paid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
          return { ...sale, amount_paid: paid, balance: Number(sale.total) - paid };
        })
      );
      setCredits(withBalance);
    } catch (e: any) {
      // Fallback if pharmacy_credit_payments table doesn't exist yet — use payment_status
      try {
        const businessId = getPharmacyBusinessId();
        const { data } = await supabase
          .from("pharmacy_sales")
          .select("id, receipt_number, total, payment_status, created_at, customer:customer_id(first_name, last_name, phone)")
          .eq("business_id", businessId)
          .in("payment_status", ["credit", "partial"])
          .order("created_at", { ascending: false });
        setCredits((data || []).map((s: any) => ({ ...s, amount_paid: 0, balance: Number(s.total) })));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!selected || !payAmount || Number(payAmount) <= 0) return;
    setPaying(true);
    try {
      const amount = Math.min(Number(payAmount), selected.balance);
      // Try to insert into credit_payments table (if it exists)
      const { error } = await supabase.from("pharmacy_credit_payments").insert([{
        sale_id: selected.id,
        amount,
        payment_method: "cash",
        note: "Paiement crédit",
      }]);

      if (error) throw error;

      // Update sale payment_status
      const newPaid = selected.amount_paid + amount;
      const newStatus = newPaid >= selected.total ? "paid" : "partial";
      await supabase.from("pharmacy_sales").update({ payment_status: newStatus }).eq("id", selected.id);

      toast.success(`Paiement de ${format(amount)} enregistré`);
      setSelected(null);
      setPayAmount("");
      load();
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement du paiement");
    } finally {
      setPaying(false);
    }
  };

  const filtered = credits.filter(c => {
    const name = c.customer ? `${c.customer.first_name} ${c.customer.last_name}` : "";
    return name.toLowerCase().includes(search.toLowerCase()) || c.receipt_number.toLowerCase().includes(search.toLowerCase());
  });

  const totalBalance = credits.reduce((s, c) => s + c.balance, 0);
  const totalClients = new Set(credits.map(c => c.customer ? `${c.customer.first_name} ${c.customer.last_name}` : "Inconnu")).size;

  return (
    <DashboardLayout role="salon_admin" title="Crédits Clients" subtitle="Gestion des ventes à crédit et suivi des soldes">
      <StaggerContainer className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StaggerItem>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde Total Impayé</p>
                    <p className="text-2xl font-bold text-red-600">{format(totalBalance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Ventes à Crédit</p>
                    <p className="text-2xl font-bold">{credits.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Clients Débiteurs</p>
                    <p className="text-2xl font-bold">{totalClients}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        </div>

        {/* Table */}
        <StaggerItem>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base">Ventes à crédit en cours</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher client / reçu..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Chargement...</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                  <p className="font-medium">Aucun crédit en cours</p>
                  <p className="text-sm text-muted-foreground">Tous les clients sont à jour !</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reçu</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Solde Dû</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(credit => (
                      <TableRow key={credit.id}>
                        <TableCell className="font-mono text-sm">{credit.receipt_number}</TableCell>
                        <TableCell className="font-medium">
                          {credit.customer ? `${credit.customer.first_name} ${credit.customer.last_name}` : <span className="text-muted-foreground italic">Inconnu</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{credit.customer?.phone || "-"}</TableCell>
                        <TableCell>{new Date(credit.created_at).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell>{format(credit.total)}</TableCell>
                        <TableCell className="font-semibold text-red-600">{format(credit.balance)}</TableCell>
                        <TableCell>
                          <Badge variant={credit.payment_status === "partial" ? "default" : "destructive"}>
                            {credit.payment_status === "partial" ? "Partiel" : "Crédit"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => { setSelected(credit); setPayAmount(String(credit.balance)); }}>
                            <DollarSign className="h-3 w-3 mr-1" /> Payer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Payment Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-4 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Client :</span> <strong>{selected.customer ? `${selected.customer.first_name} ${selected.customer.last_name}` : "Inconnu"}</strong></p>
                <p><span className="text-muted-foreground">Reçu :</span> <strong>{selected.receipt_number}</strong></p>
                <p><span className="text-muted-foreground">Solde dû :</span> <strong className="text-red-600">{format(selected.balance)}</strong></p>
              </div>
              <div>
                <Label>Montant à encaisser</Label>
                <Input
                  type="number"
                  min="0"
                  max={selected.balance}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Annuler</Button>
            <Button onClick={handlePay} disabled={paying || !payAmount || Number(payAmount) <= 0}>
              {paying ? "Enregistrement..." : "Confirmer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
