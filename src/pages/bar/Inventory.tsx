import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId } from "@/lib/branch";
import { toast } from "sonner";
import { Package, Search, Plus, ArrowDownToLine, AlertCircle } from "lucide-react";

interface BarProduct {
  id: string;
  name: string;
  category_id: string;
  stock_cases: number;
  stock_units: number;
  units_per_case: number;
  price_per_unit: number;
  price_per_case: number;
  min_stock_level: number;
  critical_stock_level: number;
}

export default function BarInventory() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);

  const [products, setProducts] = useState<BarProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modal Stock Entry
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BarProduct | null>(null);
  const [entryCases, setEntryCases] = useState<number>(0);
  const [entryUnits, setEntryUnits] = useState<number>(0);

  const loadProducts = async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bar_products")
        .select("*")
        .eq("branch_id", branchId)
        .order("name");
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      toast.error("Erreur de chargement de l'inventaire");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [branchId]);

  const handleOpenEntry = (product: BarProduct) => {
    setSelectedProduct(product);
    setEntryCases(0);
    setEntryUnits(0);
    setEntryModalOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!selectedProduct || !branchId) return;
    if (entryCases === 0 && entryUnits === 0) {
      return toast.error("Veuillez saisir une quantité");
    }

    try {
      const newCases = selectedProduct.stock_cases + entryCases;
      const newUnits = selectedProduct.stock_units + entryUnits;

      const { error: updateErr } = await supabase
        .from("bar_products")
        .update({ stock_cases: newCases, stock_units: newUnits })
        .eq("id", selectedProduct.id);

      if (updateErr) throw updateErr;

      await supabase.from("bar_stock_movements").insert({
        branch_id: branchId,
        product_id: selectedProduct.id,
        movement_type: "ENTREE",
        quantity_cases: entryCases,
        quantity_units: entryUnits,
        notes: "Réception de marchandises",
      });

      toast.success("Stock mis à jour avec succès");
      setEntryModalOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="salon_admin" title="Inventaire Bar" subtitle="Gestion des stocks en caisses et unités">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Produits & Boissons
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher un produit..." 
                    className="pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Nouveau Produit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common.product")}</TableHead>
                        <TableHead className="text-center">Caisses</TableHead>
                        <TableHead className="text-center">Unités Restantes</TableHead>
                        <TableHead className="text-center">Total (Unités)</TableHead>
                        <TableHead className="text-right">Prix Unité / Caisse</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((p) => {
                        const totalUnits = (p.stock_cases * p.units_per_case) + p.stock_units;
                        const isCritical = totalUnits <= p.critical_stock_level;
                        const isLow = totalUnits <= p.min_stock_level && !isCritical;
                        
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {isCritical && <AlertCircle className="h-4 w-4 text-destructive" />}
                                {p.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono text-sm">{p.stock_cases}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono text-sm">{p.stock_units}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              <span className={isCritical ? "text-destructive" : isLow ? "text-warning" : "text-success"}>
                                {totalUnits}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm">
                              {format(p.price_per_unit)} / {format(p.price_per_case)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => handleOpenEntry(p)}>
                                <ArrowDownToLine className="h-3 w-3" /> Entrée
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredProducts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            Aucun produit trouvé.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={entryModalOpen} onOpenChange={setEntryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrée de stock : {selectedProduct?.name}</DialogTitle>
            <DialogDescription>
              Ajouter des quantités reçues. 1 Caisse = {selectedProduct?.units_per_case} unités.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de Caisses</Label>
              <Input 
                type="number" 
                min="0" 
                value={entryCases} 
                onChange={(e) => setEntryCases(Number(e.target.value))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Unités Individuelles</Label>
              <Input 
                type="number" 
                min="0" 
                value={entryUnits} 
                onChange={(e) => setEntryUnits(Number(e.target.value))} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveEntry}>Enregistrer l'entrée</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
