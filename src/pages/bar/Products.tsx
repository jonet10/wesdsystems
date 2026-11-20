import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Package,
  Search,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  Beer,
  Wine,
  UtensilsCrossed,
  Sparkles,
  RefreshCw,
  DollarSign,
  Percent,
  CheckCircle2,
  Tag,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId } from "@/lib/branch";
import { barRestoService } from "@/modules/restaurant/services/barRestoService";
import type { BarProduct } from "@/modules/restaurant/types";
import { toast } from "sonner";

export default function BarProducts() {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const effectiveBranchId = branchId || profile?.business_id || "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

  const [products, setProducts] = useState<BarProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal: Nouveau Produit
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newCategory, setNewCategory] = useState("Bières");
  const [newCostUnit, setNewCostUnit] = useState<number>(0);
  const [newUnitsPerCase, setNewUnitsPerCase] = useState<number>(24);
  const [newPriceUnit, setNewPriceUnit] = useState<number>(0);
  const [newPriceCase, setNewPriceCase] = useState<number>(0);

  // Modal: Modifier Produit & Prix
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BarProduct | null>(null);
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editCostUnit, setEditCostUnit] = useState<number>(0);
  const [editUnitsPerCase, setEditUnitsPerCase] = useState<number>(24);
  const [editPriceUnit, setEditPriceUnit] = useState<number>(0);
  const [editPriceCase, setEditPriceCase] = useState<number>(0);

  // Modal: Marge en pourcentage en masse
  const [marginModalOpen, setMarginModalOpen] = useState(false);
  const [marginPercent, setMarginPercent] = useState<string>("30");
  const [roundUp, setRoundUp] = useState<boolean>(true);
  const [isApplyingMargin, setIsApplyingMargin] = useState(false);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await barRestoService.getProducts(effectiveBranchId);
      setProducts(data);
    } catch (err: any) {
      toast.error("Erreur de chargement des produits");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [effectiveBranchId]);

  // KPIs
  const stats = useMemo(() => {
    const total = products.length;
    const beers = products.filter(
      (p) => p.name.toLowerCase().includes("prestige") || p.name.toLowerCase().includes("bière") || p.name.toLowerCase().includes("guinness")
    ).length;
    const rums = products.filter(
      (p) => p.name.toLowerCase().includes("barbancourt") || p.name.toLowerCase().includes("rhum") || p.name.toLowerCase().includes("whisky")
    ).length;
    const food = products.filter(
      (p) => p.name.toLowerCase().includes("griot") || p.name.toLowerCase().includes("tassot") || p.name.toLowerCase().includes("fritay") || p.name.toLowerCase().includes("poulet")
    ).length;
    return { total, beers, rums, food };
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesCategory = true;
      if (categoryFilter === "BEERS") {
        matchesCategory =
          p.name.toLowerCase().includes("prestige") ||
          p.name.toLowerCase().includes("bière") ||
          p.name.toLowerCase().includes("guinness") ||
          p.name.toLowerCase().includes("heineken") ||
          p.name.toLowerCase().includes("corona");
      } else if (categoryFilter === "RUMS") {
        matchesCategory =
          p.name.toLowerCase().includes("barbancourt") ||
          p.name.toLowerCase().includes("rhum") ||
          p.name.toLowerCase().includes("bakara") ||
          p.name.toLowerCase().includes("whisky") ||
          p.name.toLowerCase().includes("vodka");
      } else if (categoryFilter === "FOOD") {
        matchesCategory =
          p.name.toLowerCase().includes("griot") ||
          p.name.toLowerCase().includes("tassot") ||
          p.name.toLowerCase().includes("fritay") ||
          p.name.toLowerCase().includes("plat") ||
          p.name.toLowerCase().includes("poulet") ||
          p.name.toLowerCase().includes("banane");
      } else if (categoryFilter === "SOFT") {
        matchesCategory =
          p.name.toLowerCase().includes("coca") ||
          p.name.toLowerCase().includes("couronne") ||
          p.name.toLowerCase().includes("red bull") ||
          p.name.toLowerCase().includes("eau") ||
          p.name.toLowerCase().includes("jus") ||
          p.name.toLowerCase().includes("toro");
      }

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredProducts.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open Edit Product Modal
  const handleOpenEdit = (p: BarProduct) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditBrand(p.brand || "");
    setEditCostUnit(p.cost_per_unit || 0);
    setEditUnitsPerCase(p.units_per_case || 24);
    setEditPriceUnit(p.price_per_unit || 0);
    setEditPriceCase(p.price_per_case || 0);
    setEditModalOpen(true);
  };

  // Apply margin shortcut inside edit modal
  const handleApplyMarginToEdit = (pct: number) => {
    if (editCostUnit <= 0) {
      return toast.warning("Renseignez d'abord le Prix d'Achat (Coût) pour calculer la marge");
    }
    const calculatedPrice = Math.ceil(editCostUnit * (1 + pct / 100));
    setEditPriceUnit(calculatedPrice);
    if (editUnitsPerCase > 1) {
      setEditPriceCase(calculatedPrice * editUnitsPerCase);
    }
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    if (!editName.trim()) return toast.error("Le nom du produit est obligatoire");
    if (editPriceUnit <= 0) return toast.error("Le prix de vente doit être supérieur à 0");

    try {
      await barRestoService.updateProduct(editingProduct.id, {
        name: editName.trim(),
        brand: editBrand.trim() || null,
        cost_per_unit: Number(editCostUnit) || 0,
        cost_per_case: (Number(editCostUnit) || 0) * (Number(editUnitsPerCase) || 24),
        units_per_case: Number(editUnitsPerCase) || 24,
        price_per_unit: Number(editPriceUnit) || 0,
        price_per_case: Number(editPriceCase) || Number(editPriceUnit) * (Number(editUnitsPerCase) || 24),
      });

      toast.success(`Prix et fiche de "${editName}" enregistrés !`);
      setEditModalOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur de mise à jour");
    }
  };

  // Save New Product
  const handleCreateProduct = async () => {
    if (!newName.trim()) return toast.error("Le nom du produit est obligatoire");
    if (newPriceUnit <= 0) return toast.error("Le prix de vente doit être supérieur à 0");

    try {
      await barRestoService.createProduct(effectiveBranchId, {
        name: newName.trim(),
        brand: newBrand.trim() || null,
        cost_per_unit: Number(newCostUnit) || 0,
        cost_per_case: (Number(newCostUnit) || 0) * (Number(newUnitsPerCase) || 24),
        units_per_case: Number(newUnitsPerCase) || 24,
        price_per_unit: Number(newPriceUnit) || 0,
        price_per_case: Number(newPriceCase) || Number(newPriceUnit) * (Number(newUnitsPerCase) || 24),
        stock_cases: 0,
        stock_units: 0,
        is_active: true,
      });

      toast.success(`Produit "${newName}" ajouté avec succès au catalogue !`);
      setNewModalOpen(false);
      setNewName("");
      setNewBrand("");
      setNewCostUnit(0);
      setNewPriceUnit(0);
      setNewPriceCase(0);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur de création");
    }
  };

  // Delete Product
  const handleDeleteProduct = async (p: BarProduct) => {
    if (confirm(`Confirmez-vous la suppression de "${p.name}" du catalogue ?`)) {
      try {
        await barRestoService.deleteProduct(p.id);
        toast.success(`"${p.name}" retiré du catalogue`);
        loadProducts();
      } catch (err: any) {
        toast.error(err.message || "Erreur de suppression");
      }
    }
  };

  // Apply Bulk Margin %
  const handleApplyBulkMargin = async () => {
    const margin = parseFloat(marginPercent);
    if (isNaN(margin) || margin < 0) {
      return toast.error("Veuillez saisir un pourcentage valide (ex: 25, 30 ou 40)");
    }

    const targetProducts = products.filter((p) => selectedIds.includes(p.id));
    if (targetProducts.length === 0) {
      return toast.warning("Sélectionnez au moins un produit");
    }

    setIsApplyingMargin(true);
    try {
      const updates = targetProducts.map((p) => {
        // Si le coût unitaire n'est pas renseigné, on se base sur le prix actuel comme référence
        const baseCost = p.cost_per_unit > 0 ? p.cost_per_unit : p.price_per_unit / 1.3;
        let newUnit = baseCost * (1 + margin / 100);
        if (roundUp) newUnit = Math.ceil(newUnit);
        else newUnit = Number(newUnit.toFixed(2));

        const upc = p.units_per_case || 24;
        const newCase = upc > 1 ? newUnit * upc : newUnit;

        return {
          id: p.id,
          price_per_unit: newUnit,
          price_per_case: newCase,
        };
      });

      await barRestoService.applyBulkMargin(updates);
      toast.success(
        `Marge de ${margin}% appliquée avec succès sur ${updates.length} produit(s) !`
      );
      setMarginModalOpen(false);
      setSelectedIds([]);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'application de la marge");
    } finally {
      setIsApplyingMargin(false);
    }
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Produits & Tarifs"
      subtitle="Gestion des prix de vente, marges bénéficiaires (%) et catalogue (Bar, Resto & Hôtel)"
    >
      <StaggerContainer className="space-y-6">
        {/* KPI Summary Cards */}
        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border/60 shadow-sm bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">
                    Total Articles
                  </p>
                  <p className="text-2xl font-black text-foreground">{stats.total}</p>
                </div>
                <Package className="h-8 w-8 text-primary/70" />
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wide">
                    Bières & Fraîches
                  </p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {stats.beers}
                  </p>
                </div>
                <Beer className="h-8 w-8 text-amber-500/70" />
              </CardContent>
            </Card>

            <Card className="border-indigo-500/30 bg-indigo-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 font-bold uppercase tracking-wide">
                    Rhums & Spiritueux
                  </p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {stats.rums}
                  </p>
                </div>
                <Wine className="h-8 w-8 text-indigo-500/70" />
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wide">
                    Plats & Fritay
                  </p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {stats.food}
                  </p>
                </div>
                <UtensilsCrossed className="h-8 w-8 text-emerald-500/70" />
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        {/* Action Toolbar & Filters */}
        <StaggerItem>
          <Card className="border-border/60">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                <Button
                  size="sm"
                  variant={categoryFilter === "ALL" ? "default" : "outline"}
                  onClick={() => setCategoryFilter("ALL")}
                  className="font-bold text-xs h-8"
                >
                  Tous ({products.length})
                </Button>
                <Button
                  size="sm"
                  variant={categoryFilter === "BEERS" ? "default" : "outline"}
                  onClick={() => setCategoryFilter("BEERS")}
                  className="gap-1 font-bold text-xs h-8 text-amber-600"
                >
                  <Beer className="h-3 w-3" /> Bières
                </Button>
                <Button
                  size="sm"
                  variant={categoryFilter === "RUMS" ? "default" : "outline"}
                  onClick={() => setCategoryFilter("RUMS")}
                  className="gap-1 font-bold text-xs h-8 text-indigo-600"
                >
                  <Wine className="h-3 w-3" /> Rhums
                </Button>
                <Button
                  size="sm"
                  variant={categoryFilter === "FOOD" ? "default" : "outline"}
                  onClick={() => setCategoryFilter("FOOD")}
                  className="gap-1 font-bold text-xs h-8 text-emerald-600"
                >
                  <UtensilsCrossed className="h-3 w-3" /> Fritay & Plats
                </Button>
                <Button
                  size="sm"
                  variant={categoryFilter === "SOFT" ? "default" : "outline"}
                  onClick={() => setCategoryFilter("SOFT")}
                  className="gap-1 font-bold text-xs h-8 text-blue-600"
                >
                  Boissons / Soft
                </Button>
              </div>

              {/* Right Side: Search & Actions */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-60">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher produit, marque..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                {/* Bulk Margin Button */}
                {selectedIds.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => setMarginModalOpen(true)}
                    className="h-8 gap-1.5 font-bold bg-primary text-primary-foreground shadow-sm"
                  >
                    <Percent className="h-3.5 w-3.5" />
                    Fixer marge % ({selectedIds.length})
                  </Button>
                )}

                {/* New Product Button */}
                <Button
                  size="sm"
                  onClick={() => setNewModalOpen(true)}
                  className="h-8 gap-1 font-bold whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Nouveau Produit
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Product Table */}
        <StaggerItem>
          <Card className="border-border/60 shadow-sm bg-card">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={
                    filteredProducts.length > 0 &&
                    selectedIds.length === filteredProducts.length
                  }
                  onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                />
                <span className="text-xs font-bold text-muted-foreground">
                  {selectedIds.length > 0
                    ? `${selectedIds.length} produit(s) sélectionné(s)`
                    : "Sélectionner tous les produits"}
                </span>
              </div>

              {selectedIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-muted-foreground h-6"
                >
                  Désélectionner
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 flex justify-center items-center text-sm text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Chargement du catalogue...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                  <p>Aucun produit ne correspond à vos filtres.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-xs">
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Produit & Marque</TableHead>
                        <TableHead className="text-right">Prix d'Achat (Coût)</TableHead>
                        <TableHead className="text-center">Marge (%)</TableHead>
                        <TableHead className="text-right">Prix Vente Unité</TableHead>
                        <TableHead className="text-right">Prix Vente Caisse</TableHead>
                        <TableHead className="text-center">Unités / Caisse</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((p) => {
                        const isSelected = selectedIds.includes(p.id);
                        const cost = Number(p.cost_per_unit || 0);
                        const sale = Number(p.price_per_unit || 0);
                        const marginPercent =
                          cost > 0 && sale > 0
                            ? (((sale - cost) / cost) * 100).toFixed(0)
                            : null;

                        return (
                          <TableRow
                            key={p.id}
                            className={`hover:bg-muted/30 transition-colors ${
                              isSelected ? "bg-primary/5" : ""
                            }`}
                          >
                            <TableCell className="w-10">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleSelect(p.id)}
                              />
                            </TableCell>

                            <TableCell>
                              <div className="font-bold text-foreground">{p.name}</div>
                              {p.brand && (
                                <span className="text-[11px] text-muted-foreground">
                                  Marque: {p.brand}
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-right text-xs text-muted-foreground font-mono">
                              {cost > 0 ? format(cost) : "—"}
                            </TableCell>

                            <TableCell className="text-center">
                              {marginPercent !== null ? (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold ${
                                    Number(marginPercent) >= 30
                                      ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                                      : "text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/5"
                                  }`}
                                >
                                  +{marginPercent}%
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right font-black text-sm text-primary font-mono">
                              {format(p.price_per_unit)}
                            </TableCell>

                            <TableCell className="text-right text-xs font-semibold text-foreground font-mono">
                              {p.units_per_case > 1 && p.price_per_case > 0 ? (
                                format(p.price_per_case)
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-center text-xs">
                              {p.units_per_case > 1 ? (
                                <Badge variant="secondary" className="text-[10px] font-semibold">
                                  {p.units_per_case} pcs/caisse
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">Unité seule</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs font-bold gap-1 text-primary border-primary/30 hover:bg-primary/10"
                                  onClick={() => handleOpenEdit(p)}
                                  title="Modifier le prix de ce produit"
                                >
                                  <Pencil className="h-3 w-3" /> Modifier Prix
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteProduct(p)}
                                  title="Supprimer ce produit"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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

      {/* Modal: Modifier Produit & Prix */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Modifier Prix & Fiche Produit
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajustez le prix de vente unitaire, le prix par caisse ou fixez la marge en pourcentage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs font-bold">Nom du produit *</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-brand" className="text-xs font-bold">Marque / Brasserie</Label>
                <Input
                  id="edit-brand"
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-cost" className="text-xs font-bold">Prix d'Achat (Coût HTG)</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  value={editCostUnit}
                  onChange={(e) => setEditCostUnit(Number(e.target.value))}
                  placeholder="Ex: 140"
                  className="font-mono"
                />
              </div>
            </div>

            {/* Quick Percentage Margin Buttons */}
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-primary flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Fixer par pourcentage de marge :
                </Label>
                {editCostUnit > 0 && editPriceUnit > 0 && (
                  <span className="text-[11px] font-black text-primary">
                    Marge actuelle : +{(((editPriceUnit - editCostUnit) / editCostUnit) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[15, 25, 35, 50].map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs font-bold bg-background hover:bg-primary hover:text-white"
                    onClick={() => handleApplyMarginToEdit(pct)}
                  >
                    +{pct}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-sale-unit" className="text-xs font-bold">
                  Prix de Vente Unitaire (HTG) *
                </Label>
                <Input
                  id="edit-sale-unit"
                  type="number"
                  value={editPriceUnit}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditPriceUnit(val);
                    if (editUnitsPerCase > 1) setEditPriceCase(val * editUnitsPerCase);
                  }}
                  className="h-10 text-base font-black text-primary font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-upc" className="text-xs font-bold">Unités / Caisse</Label>
                <Input
                  id="edit-upc"
                  type="number"
                  value={editUnitsPerCase}
                  onChange={(e) => {
                    const upc = Number(e.target.value) || 1;
                    setEditUnitsPerCase(upc);
                    if (upc > 1) setEditPriceCase(editPriceUnit * upc);
                  }}
                />
              </div>
            </div>

            {editUnitsPerCase > 1 && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="edit-sale-case" className="text-xs font-bold">
                    Prix de Vente Caisse ({editUnitsPerCase} unités)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-primary"
                    onClick={() => setEditPriceCase(editPriceUnit * editUnitsPerCase)}
                  >
                    Auto ({format(editPriceUnit * editUnitsPerCase)})
                  </Button>
                </div>
                <Input
                  id="edit-sale-case"
                  type="number"
                  value={editPriceCase}
                  onChange={(e) => setEditPriceCase(Number(e.target.value))}
                  className="font-mono font-bold"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} className="font-bold">
              Enregistrer le Tarif
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Nouveau Produit */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-600" />
              Ajouter un Nouveau Produit
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajoutez une boisson, bouteille ou plat au catalogue avec ses prix d'achat et de vente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-name" className="text-xs font-bold">Nom du produit *</Label>
              <Input
                id="new-name"
                placeholder="Ex: Prestige Bouteille, Fritay Tassot..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-brand" className="text-xs font-bold">Marque (Optionnel)</Label>
                <Input
                  id="new-brand"
                  placeholder="Ex: BRANA, Barbancourt..."
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-cost" className="text-xs font-bold">Prix d'Achat (HTG)</Label>
                <Input
                  id="new-cost"
                  type="number"
                  placeholder="Ex: 140"
                  value={newCostUnit || ""}
                  onChange={(e) => {
                    const cost = Number(e.target.value);
                    setNewCostUnit(cost);
                    // Calcul par défaut +30%
                    if (cost > 0 && newPriceUnit === 0) {
                      const calculated = Math.ceil(cost * 1.3);
                      setNewPriceUnit(calculated);
                      setNewPriceCase(calculated * newUnitsPerCase);
                    }
                  }}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-sale-unit" className="text-xs font-bold">
                  Prix de Vente Unité (HTG) *
                </Label>
                <Input
                  id="new-sale-unit"
                  type="number"
                  placeholder="Ex: 175"
                  value={newPriceUnit || ""}
                  onChange={(e) => {
                    const price = Number(e.target.value);
                    setNewPriceUnit(price);
                    if (newUnitsPerCase > 1) setNewPriceCase(price * newUnitsPerCase);
                  }}
                  className="h-10 text-base font-black text-primary font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-upc" className="text-xs font-bold">Unités / Caisse</Label>
                <Input
                  id="new-upc"
                  type="number"
                  value={newUnitsPerCase}
                  onChange={(e) => {
                    const upc = Number(e.target.value) || 1;
                    setNewUnitsPerCase(upc);
                    if (upc > 1) setNewPriceCase(newPriceUnit * upc);
                  }}
                />
              </div>
            </div>

            {newUnitsPerCase > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="new-sale-case" className="text-xs font-bold">
                  Prix de Vente Caisse ({newUnitsPerCase} unités)
                </Label>
                <Input
                  id="new-sale-case"
                  type="number"
                  placeholder="Ex: 3800"
                  value={newPriceCase || ""}
                  onChange={(e) => setNewPriceCase(Number(e.target.value))}
                  className="font-mono font-bold"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateProduct} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              Créer le Produit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Fixer Marge % en Masse */}
      <Dialog open={marginModalOpen} onOpenChange={setMarginModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Fixer la marge de vente en pourcentage
            </DialogTitle>
            <DialogDescription className="text-xs">
              Appliquez une marge commerciale sur le coût d'achat pour les{" "}
              <strong>{selectedIds.length}</strong> produit(s) sélectionné(s).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="margin-pct" className="text-xs font-bold">
                Pourcentage de marge souhaité (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="margin-pct"
                  type="number"
                  min="0"
                  max="500"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(e.target.value)}
                  className="text-lg font-black text-primary font-mono"
                  placeholder="Ex: 35"
                />
                <span className="font-black text-lg text-muted-foreground">%</span>
              </div>

              {/* Raccourcis de marge */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {["15", "25", "35", "50"].map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    size="sm"
                    variant={marginPercent === pct ? "default" : "outline"}
                    className="font-bold text-xs h-8"
                    onClick={() => setMarginPercent(pct)}
                  >
                    +{pct}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="round-up"
                checked={roundUp}
                onCheckedChange={(checked) => setRoundUp(Boolean(checked))}
              />
              <Label htmlFor="round-up" className="text-xs font-medium cursor-pointer">
                Arrondir les prix à la gourde supérieure (ex: 174,3 G → 175 G)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarginModalOpen(false)}
              disabled={isApplyingMargin}
            >
              Annuler
            </Button>
            <Button
              onClick={handleApplyBulkMargin}
              disabled={isApplyingMargin || !marginPercent}
              className="font-bold gap-2"
            >
              <Percent className="h-4 w-4" />
              {isApplyingMargin ? "Application..." : `Appliquer à ${selectedIds.length} produit(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
