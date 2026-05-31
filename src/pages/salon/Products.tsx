import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId } from "@/lib/branch";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { toast } from "sonner";
import {
  Package, Search, Plus, Pencil, Trash2
} from "lucide-react";
import { calculatePackagingEconomics, normalizePackagingQuantity, type PackagingType, PACKAGING_TYPES } from "@/lib/packaging";

interface Product {
  id: string;
  branch_id: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  sku?: string;
  barcode?: string;
  unit_price: number;
  cost_price?: number;
  packaging_type?: PackagingType | null;
  package_quantity?: number | null;
  purchase_price_global?: number | null;
  unit_cost_price?: number | null;
  unit_profit?: number | null;
  package_profit?: number | null;
  is_active: boolean;
  created_at: string;
}

const categories = [
  "Boissons", "Shampoing", "Gel", "Cire", "Parfum", "Accessoire",
  "Coloration", "Soin", "Huile", "Appareil", "Autre"
];

export default function ProductsPage() {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const { data: branches = [] } = useBusinessBranches();
  const activeBranchId = useMemo(() => {
    const validBranchId = branchId && branches.some((branch) => branch.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [packagingType, setPackagingType] = useState<PackagingType>("custom");
  const [packageQuantity, setPackageQuantity] = useState("1");
  const [purchasePriceGlobal, setPurchasePriceGlobal] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");

  const loadProducts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("salon_products")
        .select("id, branch_id, name, description, category, brand, sku, barcode, unit_price, cost_price, packaging_type, package_quantity, purchase_price_global, unit_cost_price, unit_profit, package_profit, is_active, created_at")
        .eq("is_active", true);
      if (activeBranchId) {
        query = query.eq("branch_id", activeBranchId);
      }
      const { data, error } = await query.order("name");
      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (err: any) {
      toast.error("Erreur chargement produits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProducts(); }, [activeBranchId]);

  const resetForm = () => {
    setEditing(null);
    setName(""); setDescription(""); setCategory(""); setBrand(""); setSku("");
    setBarcode(""); setPackagingType("custom"); setPackageQuantity("1"); setPurchasePriceGlobal("0"); setUnitPrice("0");
  };

  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name); setDescription(p.description || ""); setCategory(p.category || "");
    setBrand(p.brand || "");
    setSku(p.sku || ""); setBarcode(p.barcode || "");
    setPackagingType(p.packaging_type || "custom");
    setPackageQuantity(String(p.package_quantity || 1));
    setPurchasePriceGlobal(String(p.purchase_price_global ?? p.cost_price ?? 0));
    setUnitPrice(String(p.unit_price));
    setOpen(true);
  };

  const pricingPreview = useMemo(() => {
    return calculatePackagingEconomics({
      packagePurchasePrice: Number(purchasePriceGlobal || 0),
      packageQuantity: normalizePackagingQuantity(packageQuantity),
      unitSellingPrice: Number(unitPrice || 0),
    });
  }, [packageQuantity, purchasePriceGlobal, unitPrice]);

  const saveProduct = async () => {
    if (!name.trim()) return toast.error("Nom du produit requis");
    const packageQty = normalizePackagingQuantity(packageQuantity);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      category: category || null,
      brand: brand.trim() || null,
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      unit_price: Number(unitPrice || 0),
      cost_price: pricingPreview.unitCost || null,
      packaging_type: packagingType,
      package_quantity: packageQty,
      purchase_price_global: Number(purchasePriceGlobal || 0),
      unit_cost_price: pricingPreview.unitCost,
      unit_profit: pricingPreview.unitProfit,
      package_profit: pricingPreview.packageProfit,
    };

    try {
      if (editing) {
        const { error } = await supabase.from("salon_products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Produit modifié");
      } else {
        const { error } = await supabase.from("salon_products").insert([{
          ...payload,
          branch_id: activeBranchId,
        }]);
        if (error) throw error;
        toast.success("Produit ajouté");
      }
      setOpen(false);
      resetForm();
      loadProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteProduct = async (product: Product) => {
    try {
      const { error } = await supabase.from("salon_products")
        .update({ is_active: false }).eq("id", product.id);
      if (error) throw error;
      toast.success("Produit supprimé");
      loadProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = useMemo(() => {
    let result = products;
    if (search) result = result.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase())
    );
    if (categoryFilter !== "Tous") result = result.filter(p => p.category === categoryFilter);
    return result;
  }, [products, search, categoryFilter]);

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Produits" subtitle="Gestion des produits de beauté">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Produits" subtitle="Gérez vos produits de beauté et accessoires">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-60"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tous">Toutes catégories</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau produit
            </Button>
          </div>
        </StaggerItem>

        <StaggerItem>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Produit</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Catégorie</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Marque</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Conditionnement</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">SKU</th>
                      <th className="text-right p-4 text-xs font-medium text-muted-foreground">Prix vente</th>
                      <th className="text-right p-4 text-xs font-medium text-muted-foreground">Prix achat</th>
                      <th className="text-right p-4 text-xs font-medium text-muted-foreground">Profit / unité</th>
                      <th className="text-right p-4 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Package className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            {p.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {p.category ? (
                          <Badge variant="outline" className="text-xs">{p.category}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-sm">
                        <span className="text-muted-foreground">{p.brand || "—"}</span>
                      </td>
                      <td className="p-4 text-sm">
                        <span className="text-muted-foreground">{p.packaging_type || "custom"}</span>
                        <span className="text-xs text-muted-foreground ml-1">({p.package_quantity || 1})</span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{p.sku || "—"}</td>
                      <td className="p-4 text-right font-medium">{format(p.unit_price)}</td>
                      <td className="p-4 text-right text-muted-foreground">
                        {p.purchase_price_global ? format(p.purchase_price_global) : p.cost_price ? format(p.cost_price) : "—"}
                      </td>
                      <td className="p-4 text-right text-muted-foreground">
                        {typeof p.unit_profit === "number" ? format(p.unit_profit) : "—"}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(p)}>
                            <Trash2 className="h-4 w-4" />
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
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[calc(100vh-1rem)] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="md:col-span-2">
                <Label>Nom du produit *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Shampoing professionnel" />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Marque</Label>
                <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ex: Prestige" />
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Code produit" />
              </div>
              <div>
                <Label>Type de conditionnement</Label>
                <Select value={packagingType} onValueChange={(value) => setPackagingType(value as PackagingType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PACKAGING_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantité contenue</Label>
                <Input type="number" min="1" value={packageQuantity} onChange={e => setPackageQuantity(e.target.value)} />
              </div>
              <div>
                <Label>Prix d'achat global</Label>
                <Input type="number" min="0" value={purchasePriceGlobal} onChange={e => setPurchasePriceGlobal(e.target.value)} />
              </div>
              <div>
                <Label>Coût unitaire calculé</Label>
                <Input type="number" value={pricingPreview.unitCost.toFixed(2)} readOnly />
              </div>
              <div>
                <Label>Prix de vente unitaire *</Label>
                <Input type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
              </div>
              <div>
                <Label>Bénéfice unitaire</Label>
                <Input type="number" value={pricingPreview.unitProfit.toFixed(2)} readOnly />
              </div>
              <div>
                <Label>Bénéfice par {packagingType === "douzaine" ? "douzaine" : "conditionnement"}</Label>
                <Input type="number" value={pricingPreview.packageProfit.toFixed(2)} readOnly />
              </div>
              <div>
                <Label>Code-barres</Label>
                <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Optionnel" />
              </div>
              <div className="md:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-semibold">Aperçu des marges</p>
                <p className="text-muted-foreground mt-1">Coût unitaire, bénéfice unitaire et bénéfice total par conditionnement sont calculés automatiquement.</p>
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={saveProduct}>
              {editing ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
