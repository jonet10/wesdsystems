import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId } from "@/lib/branch";
import { toast } from "sonner";
import { Package, Search, Plus, ArrowDownToLine, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import { barRestoService } from "@/modules/restaurant/services/barRestoService";
import type { BarProduct } from "@/modules/restaurant/types";

export default function BarInventory() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const effectiveBranchId = branchId || profile?.business_id || "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

  const [products, setProducts] = useState<BarProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  // Modal Stock Entry
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BarProduct | null>(null);
  const [entryCases, setEntryCases] = useState<number>(0);
  const [entryUnits, setEntryUnits] = useState<number>(0);

  // Modal New Product
  const [newProductModalOpen, setNewProductModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newUnitsPerCase, setNewUnitsPerCase] = useState(24);
  const [newPriceUnit, setNewPriceUnit] = useState(0);
  const [newPriceCase, setNewPriceCase] = useState(0);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await barRestoService.getProducts(effectiveBranchId);
      setProducts(data);
    } catch (err: any) {
      toast.error("Erreur de chargement de l'inventaire");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [effectiveBranchId]);

  const handleSeedHaiti = async () => {
    setIsSeeding(true);
    try {
      await barRestoService.seedHaitiCatalog(effectiveBranchId);
      toast.success("Catalogue Haïti (Prestige, Barbancourt, Fritay...) chargé !");
      await loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur de chargement");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenEntry = (product: BarProduct) => {
    setSelectedProduct(product);
    setEntryCases(0);
    setEntryUnits(0);
    setEntryModalOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!selectedProduct) return;
    if (entryCases === 0 && entryUnits === 0) {
      return toast.error("Veuillez saisir une quantité");
    }

    try {
      const newCases = (selectedProduct.stock_cases || 0) + entryCases;
      const newUnits = (selectedProduct.stock_units || 0) + entryUnits;

      const { error: updateErr } = await supabase
        .from("bar_products")
        .update({ stock_cases: newCases, stock_units: newUnits })
        .eq("id", selectedProduct.id);

      if (updateErr) throw updateErr;

      await supabase.from("bar_stock_movements").insert({
        branch_id: effectiveBranchId,
        product_id: selectedProduct.id,
        movement_type: "ENTREE",
        quantity_cases: entryCases,
        quantity_units: entryUnits,
        notes: "Réception de marchandises / Entrée stock",
      });

      toast.success("Stock mis à jour avec succès");
      setEntryModalOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    }
  };

  const handleCreateProduct = async () => {
    if (!newName.trim()) return toast.error("Nom du produit obligatoire");

    try {
      const { error } = await supabase.from("bar_products").insert([
        {
          branch_id: effectiveBranchId,
          name: newName.trim(),
          brand: newBrand.trim() || null,
          units_per_case: Number(newUnitsPerCase) || 24,
          price_per_unit: Number(newPriceUnit) || 0,
          price_per_case: Number(newPriceCase) || Number(newPriceUnit) * (Number(newUnitsPerCase) || 24),
          stock_cases: 0,
          stock_units: 0,
          is_active: true,
        },
      ]);

      if (error) throw error;

      toast.success("Produit ajouté avec succès");
      setNewProductModalOpen(false);
      setNewName("");
      setNewBrand("");
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);

  return (
    <DashboardLayout
      role="salon_admin"
      title="Inventaire & Stocks"
      subtitle="Gestion double-stock en Caisses & Unités (Bar, Resto & Hôtel)"
    >
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <Card className="border-border/60 shadow-sm bg-card">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 gap-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Produits, Boissons & Plats ({products.length})
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher (Prestige, Barbancourt...)"
                    className="pl-8 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {products.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 font-bold border-primary text-primary"
                    onClick={handleSeedHaiti}
                    disabled={isSeeding}
                  >
                    <Sparkles className="h-4 w-4" /> Charger Haïti
                  </Button>
                )}
                <Button size="sm" onClick={() => setNewProductModalOpen(true)} className="gap-1 font-bold whitespace-nowrap">
                  <Plus className="h-4 w-4" /> Nouveau Produit
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="py-12 flex justify-center items-center text-sm text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Chargement des stocks...
                </div>
              ) : products.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Aucun produit dans l'inventaire de cette branche.</p>
                  <Button onClick={handleSeedHaiti} disabled={isSeeding} className="gap-2 font-bold">
                    <Sparkles className="h-4 w-4" /> Charger le catalogue standard Haïti
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit / Article</TableHead>
                        <TableHead className="text-center">Stock Caisses</TableHead>
                        <TableHead className="text-center">Unités Restantes</TableHead>
                        <TableHead className="text-center">Total Unités</TableHead>
                        <TableHead className="text-right">Prix Unité / Caisse</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((p) => {
                        const totalUnits = (p.stock_cases || 0) * (p.units_per_case || 24) + (p.stock_units || 0);
                        const isLowStock = totalUnits <= (p.critical_stock_level || 5);

                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-bold">
                              <div>
                                <span>{p.name}</span>
                                {p.brand && <span className="text-xs text-muted-foreground ml-2 font-normal">({p.brand})</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {p.units_per_case > 1 ? (
                                <Badge variant="outline" className="font-bold">
                                  {p.stock_cases || 0} caisses
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {p.stock_units || 0}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {isLowStock ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertCircle className="h-3 w-3" /> {totalUnits}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{totalUnits}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              <span className="font-bold text-primary">{format(p.price_per_unit)}</span>
                              {p.units_per_case > 1 && p.price_per_case > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Caisse: {format(p.price_per_case)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEntry(p)}
                                className="gap-1 text-xs font-bold"
                              >
                                <ArrowDownToLine className="h-3.5 w-3.5" /> Entrée Stock
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Stock Entry Dialog */}
      <Dialog open={entryModalOpen} onOpenChange={setEntryModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Entrée en Stock</DialogTitle>
            <DialogDescription className="text-xs font-semibold text-primary">
              {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {selectedProduct && selectedProduct.units_per_case > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="entry-cases" className="text-xs font-bold">
                  Nombre de Caisses à ajouter ({selectedProduct.units_per_case} pcs / caisse)
                </Label>
                <Input
                  id="entry-cases"
                  type="number"
                  min="0"
                  value={entryCases}
                  onChange={(e) => setEntryCases(parseInt(e.target.value) || 0)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="entry-units" className="text-xs font-bold">
                Unités / Bouteilles individuelles
              </Label>
              <Input
                id="entry-units"
                type="number"
                min="0"
                value={entryUnits}
                onChange={(e) => setEntryUnits(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEntry} className="font-bold">
              Enregistrer Entrée
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Product Dialog */}
      <Dialog open={newProductModalOpen} onOpenChange={setNewProductModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Nouveau Produit / Boisson</DialogTitle>
            <DialogDescription className="text-xs">
              Ajouter un produit vendu au bar ou au restaurant
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="prod-name" className="text-xs font-bold">Nom de l'article *</Label>
              <Input
                id="prod-name"
                placeholder="Ex: Prestige, Rhum Barbancourt..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-brand" className="text-xs font-bold">Marque</Label>
                <Input
                  id="prod-brand"
                  placeholder="Ex: BRANA, Barbancourt..."
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="units-case" className="text-xs font-bold">Unités / Caisse</Label>
                <Input
                  id="units-case"
                  type="number"
                  value={newUnitsPerCase}
                  onChange={(e) => setNewUnitsPerCase(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price-unit" className="text-xs font-bold">Prix Unitaire (HTG)</Label>
                <Input
                  id="price-unit"
                  type="number"
                  value={newPriceUnit}
                  onChange={(e) => setNewPriceUnit(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price-case" className="text-xs font-bold">Prix Caisse (HTG)</Label>
                <Input
                  id="price-case"
                  type="number"
                  value={newPriceCase}
                  onChange={(e) => setNewPriceCase(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProductModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateProduct} className="font-bold">
              Créer l'article
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
