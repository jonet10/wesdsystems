import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { listSales, getSaleDetails } from "@/modules/stationery/services/sales";
import { toast } from "sonner";
import { Search, Loader2, FileText, Printer, CheckCircle2, AlertCircle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Badge } from "@/components/ui/badge";

export default function Sales() {
  const businessId = useStationeryBusinessId();
  const { format } = useCurrency();
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const salesData = await listSales(businessId, null);
      setData(salesData);
    } catch (e: any) {
      toast.error(e.message || "Erreur de chargement des ventes");
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { load(); }, [businessId]);

  const filtered = data.filter((s) => {
    const term = search.toLowerCase();
    if (!search) return true;
    const invNo = s.invoice_number?.toLowerCase() || "";
    const customer = s.customer ? `${s.customer.first_name} ${s.customer.last_name}`.toLowerCase() : "";
    return invNo.includes(term) || customer.includes(term);
  });

  const totalRevenue = filtered.reduce((acc, sale) => acc + (sale.amount_paid || sale.total_amount || 0), 0);

  const openDetails = async (sale: any) => {
    setSelectedSale(sale);
    setDetailsOpen(true);
    setLoadingItems(true);
    try {
      const items = await getSaleDetails(sale.id);
      setSaleItems(items);
    } catch (e: any) {
      toast.error("Erreur du chargement des détails");
    } finally {
      setLoadingItems(false);
    }
  };

  const getStatusBadge = (balance: number) => {
    if (balance <= 0) return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1"/> Payé</Badge>;
    return <Badge variant="default" className="bg-amber-500/10 text-amber-500 border-amber-500/20"><AlertCircle className="w-3 h-3 mr-1"/> Partiel</Badge>;
  };

  return (
    <DashboardLayout role="salon_admin" title="Ventes" subtitle="Historique des factures et reçus">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher N° Facture, Client..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-muted px-4 py-2 rounded-lg border border-border">
                <span className="text-sm text-muted-foreground mr-2">Revenus affichés:</span>
                <span className="font-bold text-emerald-500">{format(totalRevenue)}</span>
              </div>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facture N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Aucune vente trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-primary">
                        {s.invoice_number}
                      </TableCell>
                      <TableCell>
                        {new Date(s.created_at).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>
                        {s.customer ? `${s.customer.first_name} ${s.customer.last_name || ''}` : "Client de passage"}
                      </TableCell>
                      <TableCell className="capitalize">{s.payment_method || "cash"}</TableCell>
                      <TableCell>{getStatusBadge(s.balance)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {format(s.total_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDetails(s)}>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Détails de la facture */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center pr-6">
              <span>Détail de la Vente {selectedSale?.invoice_number}</span>
              <Button variant="outline" size="sm" className="gap-2">
                <Printer className="w-4 h-4" /> Réimprimer
              </Button>
            </DialogTitle>
            <DialogDescription>
              Enregistrée le {selectedSale && new Date(selectedSale.created_at).toLocaleString("fr-FR")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg border border-border/50">
              <div>
                <p className="text-muted-foreground">Client</p>
                <p className="font-medium">{selectedSale?.customer ? `${selectedSale.customer.first_name} ${selectedSale.customer.last_name || ''}` : "Client de passage"}</p>
                {selectedSale?.customer?.phone && <p className="text-xs text-muted-foreground">{selectedSale.customer.phone}</p>}
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Méthode de Paiement</p>
                <p className="font-medium capitalize">{selectedSale?.payment_method}</p>
                <p className="text-xs text-muted-foreground">
                  Payé: {selectedSale && format(selectedSale.amount_paid)}
                </p>
              </div>
            </div>

            <div className="border border-border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Prix Unitaire</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingItems ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : saleItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Aucun article trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    saleItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium">{item.product?.name || "Produit inconnu"}</p>
                          <p className="text-xs text-muted-foreground">{item.product?.reference || ""}</p>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{format(item.unit_price)}</TableCell>
                        <TableCell className="text-right font-medium">{format(item.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  
                  {/* Totaux */}
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={3} className="text-right font-medium">Sous-total</TableCell>
                    <TableCell className="text-right font-medium">{selectedSale && format(selectedSale.total_amount)}</TableCell>
                  </TableRow>
                  {selectedSale?.discount_amount > 0 && (
                    <TableRow className="bg-muted/30 text-destructive">
                      <TableCell colSpan={3} className="text-right font-medium">Remise</TableCell>
                      <TableCell className="text-right font-medium">-{format(selectedSale.discount_amount)}</TableCell>
                    </TableRow>
                  )}
                  {selectedSale?.tax_amount > 0 && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="text-right font-medium">Taxes</TableCell>
                      <TableCell className="text-right font-medium">{format(selectedSale.tax_amount)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-muted/50 border-t-2 border-border">
                    <TableCell colSpan={3} className="text-right font-bold text-lg">Total à payer</TableCell>
                    <TableCell className="text-right font-bold text-lg text-emerald-500">
                      {selectedSale && format(selectedSale.total_amount - (selectedSale.discount_amount || 0) + (selectedSale.tax_amount || 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
