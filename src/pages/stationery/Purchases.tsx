import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { listPurchases } from "@/modules/stationery/services/purchases";
import { toast } from "sonner";
import { Search, Loader2, Plus, ShoppingCart, Truck } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Badge } from "@/components/ui/badge";

export default function Purchases() {
  const businessId = useStationeryBusinessId();
  const { format } = useCurrency();
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const purchasesData = await listPurchases(businessId, null);
      setData(purchasesData);
    } catch (e: any) {
      toast.error(e.message || "Erreur de chargement des achats");
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { load(); }, [businessId]);

  const filtered = data.filter((p) => {
    const term = search.toLowerCase();
    if (!search) return true;
    const invNo = p.invoice_number?.toLowerCase() || "";
    const supp = p.supplier && p.supplier.company_name ? p.supplier.company_name.toLowerCase() : "";
    return invNo.includes(term) || supp.includes(term);
  });

  const getStatusBadge = (status: string) => {
    if (status === 'received') return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Reçu</Badge>;
    if (status === 'pending') return <Badge variant="default" className="bg-amber-500/10 text-amber-500 border-amber-500/20">En attente</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <DashboardLayout role="salon_admin" title="Achats & Réassort" subtitle="Gestion des commandes fournisseurs">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher Fournisseur, N° Facture..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nouvel Achat
            </Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      Aucun achat enregistré.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {new Date(p.purchase_date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="font-medium text-primary">
                        {p.invoice_number || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          {p.supplier ? p.supplier.company_name : "Fournisseur Inconnu"}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        {format(p.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enregistrer un nouvel achat</DialogTitle>
            <DialogDescription>
              Cette fonctionnalité permet d'ajouter du stock depuis un fournisseur. 
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Plus className="h-8 w-8" />
            </div>
            <p className="text-muted-foreground">
              L'interface complète de sélection de produits et de scan de code-barres pour les fournisseurs est en cours de déploiement final.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
