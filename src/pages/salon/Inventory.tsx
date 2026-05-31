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
import { toast } from "sonner";
import { Package, Search, Plus, Pencil, RotateCcw, ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { calculatePackagingEconomics, normalizePackagingQuantity, type PackagingType, PACKAGING_TYPES } from "@/lib/packaging";

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

export default function InventoryPage() {
  const { profile } = useAuth();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const { data: branches = [] } = useBusinessBranches();
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

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [packagingType, setPackagingType] = useState<PackagingType>("custom");
  const [packageQuantity, setPackageQuantity] = useState("1");
  const [purchasePriceGlobal, setPurchasePriceGlobal] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("10");

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

  useEffect(() => {
    void loadProducts(activeBranchId);
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
    setOpen(true);
  };

  const pricingPreview = useMemo(() => calculatePackagingEconomics({
    packagePurchasePrice: Number(purchasePriceGlobal || 0),
    packageQuantity: normalizePackagingQuantity(packageQuantity),
    unitSellingPrice: Number(sellingPrice || 0),
  }), [packageQuantity, purchasePriceGlobal, sellingPrice]);

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
    };

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
    setStockCases("0");
    setStockUnits("0");
  };

  const applyStock = async () => {
    if (!stockProduct) return;
    const cases = Number(stockCases || 0);
    const units = Number(stockUnits || 0);
    const unitsPerCase = normalizePackagingQuantity(stockProduct.package_quantity || 1);
    const delta = cases * unitsPerCase + units;

    let nextStock = stockProduct.quantity_in_stock;
    if (stockMode === "entry") nextStock += delta;
    if (stockMode === "exit") nextStock = Math.max(0, nextStock - delta);
    if (stockMode === "adjustment") nextStock = Math.max(0, delta);

    try {
      const { error } = await supabase
        .from("salon_products")
        .update({ quantity_in_stock: nextStock })
        .eq("id", stockProduct.id);
      if (error) throw error;
      toast.success("Stock mis à jour");
      setStockProduct(null);
      await loadProducts(activeBranchId);
    } catch (err: any) {
      toast.error(err.message || "Impossible de mettre à jour le stock");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => [p.name, p.brand, p.sku, p.category].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [products, search]);

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
      <StaggerContainer className="space-y-6">
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

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left p-3 text-xs">Produit</th>
                    <th className="text-left p-3 text-xs">Marque</th>
                    <th className="text-left p-3 text-xs">Catégorie</th>
                    <th className="text-left p-3 text-xs">Stock</th>
                    <th className="text-left p-3 text-xs">Seuil</th>
                    <th className="text-left p-3 text-xs">Achat</th>
                    <th className="text-left p-3 text-xs">Vente</th>
                    <th className="text-right p-3 text-xs">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border">
                      <td className="p-3 text-sm font-medium">{p.name}</td>
                      <td className="p-3 text-sm">{p.brand || "-"}</td>
                      <td className="p-3 text-sm">{p.category || "-"}</td>
                      <td className="p-3 text-sm">
                        <Badge variant={p.quantity_in_stock <= p.reorder_level ? "destructive" : "secondary"}>{p.quantity_in_stock}</Badge>
                      </td>
                      <td className="p-3 text-sm">{p.reorder_level}</td>
                      <td className="p-3 text-sm">{p.purchase_price_global ?? p.unit_cost_price ?? 0}</td>
                      <td className="p-3 text-sm">{p.unit_price}</td>
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
                  ))}
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
                  <Label>Nom</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Marque</Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Boissons, Soin, etc." />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
                <div>
                  <Label>Type de conditionnement</Label>
                  <select value={packagingType} onChange={(e) => setPackagingType(e.target.value as PackagingType)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {PACKAGING_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Quantité contenue</Label>
                  <Input type="number" min="1" value={packageQuantity} onChange={(e) => setPackageQuantity(e.target.value)} />
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
                </div>
              </div>
            </div>
            <DialogFooter className="sticky bottom-0 bg-background pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
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
                {stockMode === "adjustment"
                  ? "Saisissez le stock final exact."
                  : "Les caisses et unités seront converties automatiquement."}
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
              <Button variant="outline" onClick={() => setStockProduct(null)}>Annuler</Button>
              <Button onClick={applyStock}>Valider</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaggerContainer>
    </DashboardLayout>
  );
}
