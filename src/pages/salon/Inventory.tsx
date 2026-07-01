import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { useActiveBranchId } from "@/lib/branch";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Package, Search, Plus, Pencil, RotateCcw, ArrowDownLeft, ArrowUpRight, SlidersHorizontal, AlertCircle } from "lucide-react";
import { calculatePackagingEconomics, normalizePackagingQuantity, type PackagingType, PACKAGING_TYPES, PACKAGING_LABELS, PACKAGING_DEFAULT_QUANTITIES } from "@/lib/packaging";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { listLowStockProducts, listStockMovements, recordStockMovement } from "@/modules/salon/inventory";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  category: string | null;
  quantity_in_stock: number;
  reorder_level: number;
  purchase_price_global: number | null;
  unit_cost_price: number | null;
  unit_price: number;
  packaging_type?: PackagingType | null;
  package_quantity?: number | null;
  unit_profit?: number | null;
  package_profit?: number | null;
  is_active: boolean;
}

type StockMode = "entry" | "exit" | "adjustment";

interface StockMovement {
  id: string;
  product_id?: string | null;
  movement_type: StockMode | "purchase" | "sale" | "adjustment" | "loss" | "audit";
  quantity_delta: number;
  reason?: string | null;
  reference_id?: string | null;
  created_at: string;
}

export default function InventoryPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const { data: branches = [], isFetching: branchesFetching } = useBusinessBranches();
  const activeBranchId = useMemo(() => {
    const validBranchId = branchId && branches.some((branch) => branch.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches]);

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockMode, setStockMode] = useState<StockMode>("entry");
  const [stockCases, setStockCases] = useState("0");
  const [stockUnits, setStockUnits] = useState("0");
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [packagingType, setPackagingType] = useState<PackagingType>("custom");
  const [packageQuantity, setPackageQuantity] = useState("1");
  const [purchasePriceGlobal, setPurchasePriceGlobal] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [initCases, setInitCases] = useState("0");

  const loadProducts = async (branchIdToUse: string | null) => {
    try {
      setLoading(true);
      if (!branchIdToUse) {
        setProducts([]);
        return;
      }
      const { data, error } = await supabase
        .from("salon_products")
        .select("id, name, sku, brand, category, quantity_in_stock, reorder_level, purchase_price_global, unit_cost_price, unit_price, packaging_type, package_quantity, unit_profit, package_profit, is_active")
        .eq("branch_id", branchIdToUse)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (err: any) {
      toast.error(err.message || "Erreur chargement inventaire");
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryMeta = async (branchIdToUse: string | null) => {
    if (!branchIdToUse) {
      setLowStockProducts([]);
      setMovements([]);
      return;
    }

    try {
      const [lowStock, stockMovements] = await Promise.all([
        listLowStockProducts(branchIdToUse),
        listStockMovements(branchIdToUse, 25),
      ]);
      setLowStockProducts(lowStock as Product[]);
      setMovements(stockMovements as StockMovement[]);
    } catch (err: any) {
      toast.error(err.message || "Impossible de charger les alertes d'inventaire");
    }
  };

  useEffect(() => {
    void loadProducts(activeBranchId);
    void loadInventoryMeta(activeBranchId);
  }, [activeBranchId]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setBrand("");
    setCategory("");
    setSku("");
    setPackagingType("custom");
    setPackageQuantity("1");
    setPurchasePriceGlobal("0");
    setSellingPrice("0");
    setReorderLevel("10");
    setInitCases("0");
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setBrand(p.brand || "");
    setCategory(p.category || "");
    setSku(p.sku || "");
    setPackagingType(p.packaging_type || "custom");
    setPackageQuantity(String(p.package_quantity || 1));
    setPurchasePriceGlobal(String(p.purchase_price_global ?? 0));
    setSellingPrice(String(p.unit_price ?? 0));
    setReorderLevel(String(p.reorder_level ?? 10));
    // Calculer le nombre de caisses actuel depuis le stock en cours
    const qPerCase = p.package_quantity && p.package_quantity > 0 ? p.package_quantity : 1;
    setInitCases(String(Math.floor((p.quantity_in_stock ?? 0) / qPerCase)));
    setOpen(true);
  };

  const pricingPreview = useMemo(() => calculatePackagingEconomics({
    packagePurchasePrice: Number(purchasePriceGlobal || 0),
    packageQuantity: normalizePackagingQuantity(packageQuantity),
    unitSellingPrice: Number(sellingPrice || 0),
  }), [packageQuantity, purchasePriceGlobal, sellingPrice]);

  const inventorySummary = useMemo(() => {
    const rows = products.map((product) => {
      const unitsPerCase = normalizePackagingQuantity(product.package_quantity || 1);
      const unitCost = Number(product.unit_cost_price ?? (product.purchase_price_global ? Number(product.purchase_price_global) / unitsPerCase : 0));
      const unitRevenue = Number(product.unit_price || 0);
      const unitProfit = Number(product.unit_profit ?? (unitRevenue - unitCost));
      const stockValue = Number(product.quantity_in_stock || 0) * unitCost;
      const potentialRevenue = Number(product.quantity_in_stock || 0) * unitRevenue;
      const potentialProfit = Number(product.quantity_in_stock || 0) * unitProfit;
      return { stockValue, potentialRevenue, potentialProfit };
    });

    const stockInvestment = rows.reduce((sum, row) => sum + row.stockValue, 0);
    const potentialProfit = rows.reduce((sum, row) => sum + row.potentialProfit, 0);
    const potentialRevenue = rows.reduce((sum, row) => sum + row.potentialRevenue, 0);
    const margin = potentialRevenue > 0 ? (potentialProfit / potentialRevenue) * 100 : 0;

    return { stockInvestment, potentialProfit, margin };
  }, [products]);

  const saveProduct = async () => {
    if (!activeBranchId) return toast.error("Sélectionnez une branche");
    if (!name.trim()) return toast.error("Nom produit requis");

    const payload = {
      branch_id: activeBranchId,
      name: name.trim(),
      brand: brand.trim() || null,
      category: category.trim() || null,
      sku: sku.trim() || null,
      packaging_type: packagingType,
      package_quantity: normalizePackagingQuantity(packageQuantity),
      purchase_price_global: Number(purchasePriceGlobal || 0),
      unit_cost_price: pricingPreview.unitCost,
      unit_price: Number(sellingPrice || 0),
      unit_profit: pricingPreview.unitProfit,
      package_profit: pricingPreview.packageProfit,
      reorder_level: Number(reorderLevel || 10),
      // Stock calculé: nombre de caisses × quantité par caisse
      quantity_in_stock: editing
        ? editing.quantity_in_stock  // en mode édition, ne pas écraser le stock existant si le champ n'est pas modifié
        : Number(initCases || 0) * normalizePackagingQuantity(packageQuantity),
    };

    // En mode édition, si l'utilisateur a modifié le nb de caisses, recalculer le stock
    if (editing) {
      const qPerCase = normalizePackagingQuantity(packageQuantity);
      const newStock = Number(initCases || 0) * qPerCase;
      const oldCases = Math.floor((editing.quantity_in_stock ?? 0) / qPerCase);
      if (Number(initCases) !== oldCases) {
        (payload as any).quantity_in_stock = newStock;
      }
    }

    try {
      const query = editing
        ? supabase.from("salon_products").update(payload).eq("id", editing.id)
        : supabase.from("salon_products").insert([payload]);
      const { error } = await query;
      if (error) throw error;
      toast.success(editing ? "Produit modifié" : "Produit ajouté");
      setOpen(false);
      resetForm();
      await loadProducts(activeBranchId);
    } catch (err: any) {
      toast.error(err.message || "Impossible d'enregistrer le produit");
    }
  };

  const openStockDialog = (product: Product, mode: StockMode) => {
    setStockProduct(product);
    setStockMode(mode);
    
    // Si ajustement manuel, pré-remplir avec la quantité en stock actuelle
    if (mode === "adjustment") {
      const qPerCase = normalizePackagingQuantity(product.package_quantity || 1);
      const currentStock = product.quantity_in_stock || 0;
      const currentCases = Math.floor(currentStock / qPerCase);
      const currentUnits = currentStock % qPerCase;
      
      setStockCases(String(currentCases));
      setStockUnits(String(currentUnits));
    } else {
      setStockCases("0");
      setStockUnits("0");
    }
  };

  const applyStock = async () => {
    if (!stockProduct) return;
    const cases = Number(stockCases || 0);
    const units = Number(stockUnits || 0);
    const unitsPerCase = normalizePackagingQuantity(stockProduct.package_quantity || 1);
    const delta = cases * unitsPerCase + units;
    const movementType: "purchase" | "sale" | "adjustment" = stockMode === "entry" ? "purchase" : stockMode === "exit" ? "sale" : "adjustment";

    let nextStock = stockProduct.quantity_in_stock;
    if (stockMode === "entry") nextStock += delta;
    if (stockMode === "exit") nextStock = Math.max(0, nextStock - delta);
    if (stockMode === "adjustment") nextStock = Math.max(0, delta);

    try {
      if (!profile?.business_id) throw new Error("Business introuvable");
      const { error } = await supabase
        .from("salon_products")
        .update({ quantity_in_stock: nextStock })
        .eq("id", stockProduct.id);
      if (error) throw error;

      await recordStockMovement({
        business_id: profile.business_id,
        branch_id: activeBranchId as string,
        product_id: stockProduct.id,
        movement_type: movementType,
        quantity_delta: stockMode === "exit" ? -delta : delta,
        reason: stockMode === "adjustment" ? "Ajustement manuel" : `Stock ${stockMode}`,
      });

      toast.success("Stock mis à jour");
      setStockProduct(null);
      await loadProducts(activeBranchId);
      await loadInventoryMeta(activeBranchId);
    } catch (err: any) {
      toast.error(err.message || "Impossible de mettre à jour le stock");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => [p.name, p.brand, p.sku, p.category].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [products, search]);

  if ((profile && branchesFetching) || (profile && !activeBranchId)) {
    return (
      <DashboardLayout role="salon_admin" title="Inventaire & Stock" subtitle="Initialisation du salon...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-xl w-full rounded-2xl border border-border bg-card/95 p-8 text-center shadow-elevated">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">L’inventaire se prépare</h2>
            <p className="text-muted-foreground">
              Nous créons la branche principale de votre salon avant d’ouvrir la gestion du stock. Vous pourrez ensuite ajouter vos produits et mouvements sans avoir à choisir une branche.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Inventaire & Stock" subtitle="Chargement...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Inventaire & Stock" subtitle="Le stock est géré ici, pas dans Produits">
      <SubscriptionGuard>
        <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Produits en alerte</p>
              <p className="text-2xl font-bold text-destructive">{lowStockProducts.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Mouvements récents</p>
              <p className="text-2xl font-bold">{movements.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Produits suivis</p>
              <p className="text-2xl font-bold">{products.length}</p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Valeur d'investissement</p>
              <p className="text-2xl font-bold">{format(inventorySummary.stockInvestment)}</p>
              <p className="text-xs text-muted-foreground mt-1">Coût total du stock en magasin</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Profit potentiel</p>
              <p className="text-2xl font-bold text-success">{format(inventorySummary.potentialProfit)}</p>
              <p className="text-xs text-muted-foreground mt-1">Selon le stock disponible actuel</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Marge moyenne</p>
              <p className="text-2xl font-bold">{inventorySummary.margin.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">Marge calculée sur les prix de vente</p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="relative md:max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher produit / SKU / marque..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau produit
            </Button>
          </div>
        </StaggerItem>

        {lowStockProducts.length > 0 && (
          <StaggerItem>
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-destructive">Alertes de réapprovisionnement</p>
                  <p className="text-sm text-muted-foreground">Les produits ci-dessous sont sous leur seuil.</p>
                </div>
                <Badge variant="destructive">{lowStockProducts.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.slice(0, 8).map((product) => (
                  <Badge key={product.id} variant="outline" className="border-destructive/30 text-destructive">
                    {product.name} ({product.quantity_in_stock}/{product.reorder_level})
                  </Badge>
                ))}
              </div>
            </div>
          </StaggerItem>
        )}

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left p-3 text-xs">{t("common.product")}</th>
                    <th className="text-left p-3 text-xs">Marque</th>
                    <th className="text-left p-3 text-xs">{t("common.category")}</th>
                    <th className="text-left p-3 text-xs">Stock Total</th>
                    <th className="text-left p-3 text-xs">Détail (Caisses/Unités)</th>
                    <th className="text-left p-3 text-xs">Seuil</th>
                    <th className="text-left p-3 text-xs">Achat</th>
                    <th className="text-left p-3 text-xs">Vente</th>
                    <th className="text-left p-3 text-xs">Investissement</th>
                    <th className="text-left p-3 text-xs">Marge</th>
                    <th className="text-right p-3 text-xs">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const unitsPerCase = p.package_quantity && p.package_quantity > 0 ? p.package_quantity : 1;
                    const cases = Math.floor(p.quantity_in_stock / unitsPerCase);
                    const remainder = p.quantity_in_stock % unitsPerCase;
                    const hasCases = unitsPerCase > 1;
                    const unitCost = Number(p.unit_cost_price ?? (p.purchase_price_global ? Number(p.purchase_price_global) / unitsPerCase : 0));
                    const unitRevenue = Number(p.unit_price || 0);
                    const unitProfit = Number(p.unit_profit ?? (unitRevenue - unitCost));
                    const stockInvestment = Number(p.quantity_in_stock || 0) * unitCost;
                    const margin = unitRevenue > 0 ? (unitProfit / unitRevenue) * 100 : 0;

                    return (
                    <tr key={p.id} className="border-b border-border">
                      <td className="p-3 text-sm font-medium">{p.name}</td>
                      <td className="p-3 text-sm">{p.brand || "-"}</td>
                      <td className="p-3 text-sm">{p.category || "-"}</td>
                      <td className="p-3 text-sm">
                        <Badge variant={p.quantity_in_stock <= p.reorder_level ? "destructive" : "secondary"}>{p.quantity_in_stock}</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">
                        {hasCases ? (
                          <span className="flex flex-col text-xs">
                            <span className="font-medium text-foreground">{cases} {PACKAGING_LABELS[p.packaging_type || "case"] || "Caisse"}(s)</span>
                            <span>+ {remainder} unité(s)</span>
                          </span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="p-3 text-sm">{p.reorder_level}</td>
                      <td className="p-3 text-sm">{format(Number(p.purchase_price_global ?? p.unit_cost_price ?? 0))}</td>
                      <td className="p-3 text-sm">{format(Number(p.unit_price || 0))}</td>
                      <td className="p-3 text-sm">{format(stockInvestment)}</td>
                      <td className="p-3 text-sm">
                        <Badge variant={margin >= 0 ? "secondary" : "destructive"}>{margin.toFixed(1)}%</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openStockDialog(p, "entry")}>
                            <ArrowDownLeft className="h-4 w-4 mr-1" /> Entrée
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openStockDialog(p, "exit")}>
                            <ArrowUpRight className="h-4 w-4 mr-1" /> Sortie
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openStockDialog(p, "adjustment")}>
                            <SlidersHorizontal className="h-4 w-4 mr-1" /> Ajuster
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Aucun produit trouvé</p>
              </div>
            )}
          </div>
        </StaggerItem>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[760px] max-h-[calc(100vh-1rem)] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
              <DialogDescription>
                Le stock se gère dans Inventaire. Ici, on maintient l'identité commerciale du produit.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="md:col-span-2">
                  <Label>{t("common.name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Marque</Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div>
                  <Label>{t("common.category")}</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Produits, Soin, etc." />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
                <div>
                  <Label>Type de conditionnement</Label>
                  <select 
                    value={packagingType} 
                    onChange={(e) => {
                      const newType = e.target.value as PackagingType;
                      setPackagingType(newType);
                      setPackageQuantity(String(PACKAGING_DEFAULT_QUANTITIES[newType] || 1));
                    }} 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {PACKAGING_TYPES.map((type) => <option key={type} value={type}>{PACKAGING_LABELS[type] || type}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Quantité contenue</Label>
                  <Input type="number" min="1" value={packageQuantity} onChange={(e) => setPackageQuantity(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="flex items-center gap-2">
                    Nombre de caisses
                    <span className="text-xs text-muted-foreground font-normal">
                      → Stock total = {Number(initCases || 0)} × {normalizePackagingQuantity(packageQuantity)} = <strong>{Number(initCases || 0) * normalizePackagingQuantity(packageQuantity)} unités</strong>
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={initCases}
                    onChange={(e) => setInitCases(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Prix d'achat global</Label>
                  <Input type="number" min="0" value={purchasePriceGlobal} onChange={(e) => setPurchasePriceGlobal(e.target.value)} />
                </div>
                <div>
                  <Label>Prix de vente unitaire</Label>
                  <Input type="number" min="0" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
                </div>
                <div>
                  <Label>Seuil de réapprovisionnement</Label>
                  <Input type="number" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
                </div>
                <div className="md:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="font-semibold">Aperçu des marges</p>
                  <p className="text-muted-foreground mt-1">
                    Coût unitaire: {pricingPreview.unitCost.toFixed(2)} | Profit unitaire: {pricingPreview.unitProfit.toFixed(2)} | Profit par conditionnement: {pricingPreview.packageProfit.toFixed(2)}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Investissement initial: {format(Number(initCases || 0) * normalizePackagingQuantity(packageQuantity) * pricingPreview.unitCost)} | Marge moyenne: {pricingPreview.unitCost > 0 ? (((pricingPreview.unitProfit / (pricingPreview.unitCost + pricingPreview.unitProfit)) || 0) * 100).toFixed(1) : "0.0"}%
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="sticky bottom-0 bg-background pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={saveProduct}>{editing ? "Modifier" : "Ajouter"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!stockProduct} onOpenChange={(openState) => !openState && setStockProduct(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>
                {stockMode === "entry" ? "Entrée de stock" : stockMode === "exit" ? "Sortie de stock" : "Ajustement manuel"} - {stockProduct?.name}
              </DialogTitle>
              <DialogDescription>
                {stockMode === "adjustment" ? (
                  stockProduct ? (
                    <>
                      Saisissez le stock final exact. Stock actuel : {" "}
                      <strong>
                        {Math.floor((stockProduct.quantity_in_stock || 0) / normalizePackagingQuantity(stockProduct.package_quantity || 1))} caisses
                        {" "}et{" "}
                        {(stockProduct.quantity_in_stock || 0) % normalizePackagingQuantity(stockProduct.package_quantity || 1)} unités
                      </strong>.
                    </>
                  ) : "Saisissez le stock final exact."
                ) : "Les caisses et unités seront converties automatiquement."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Caisses</Label>
                  <Input type="number" min="0" value={stockCases} onChange={(e) => setStockCases(e.target.value)} />
                </div>
                <div>
                  <Label>Unités</Label>
                  <Input type="number" min="0" value={stockUnits} onChange={(e) => setStockUnits(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {stockProduct ? `${normalizePackagingQuantity(stockProduct.package_quantity || 1)} unités par conditionnement` : ""}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStockProduct(null)}>{t("common.cancel")}</Button>
              <Button onClick={applyStock}>{t("common.validate")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">Historique des mouvements</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left p-3 text-xs">{t("common.date")}</th>
                    <th className="text-left p-3 text-xs">{t("common.type")}</th>
                    <th className="text-left p-3 text-xs">{t("common.product")}</th>
                    <th className="text-left p-3 text-xs">Delta</th>
                    <th className="text-left p-3 text-xs">Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => {
                    const product = products.find((p) => p.id === movement.product_id);
                    return (
                      <tr key={movement.id} className="border-b border-border">
                        <td className="p-3 text-sm">{new Date(movement.created_at).toLocaleString()}</td>
                        <td className="p-3 text-sm capitalize">{movement.movement_type}</td>
                        <td className="p-3 text-sm">{product?.name || movement.product_id || "-"}</td>
                        <td className="p-3 text-sm font-medium">{movement.quantity_delta > 0 ? `+${movement.quantity_delta}` : movement.quantity_delta}</td>
                        <td className="p-3 text-sm text-muted-foreground">{movement.reason || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {movements.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Aucun mouvement enregistré</p>
              </div>
            )}
          </div>
        </StaggerItem>
      </StaggerContainer>
      </SubscriptionGuard>
    </DashboardLayout>
  );
}
