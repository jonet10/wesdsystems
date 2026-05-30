import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calculatePackagingEconomics, normalizePackagingQuantity, type PackagingType, PACKAGING_TYPES } from "@/lib/packaging";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  minimum_stock: number;
  purchase_price: number;
  selling_price: number;
  packaging_type?: PackagingType | null;
  package_quantity?: number | null;
  purchase_price_global?: number | null;
  unit_cost_price?: number | null;
  unit_profit?: number | null;
  package_profit?: number | null;
  category_id: string | null;
  is_active: boolean;
}

interface AlertRow {
  id: string;
  message: string;
  alert_type: string;
  is_resolved: boolean;
  created_at: string;
}

export default function InventoryPage() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [packagingType, setPackagingType] = useState<PackagingType>("custom");
  const [packageQuantity, setPackageQuantity] = useState("1");
  const [quantity, setQuantity] = useState("0");
  const [minimumStock, setMinimumStock] = useState("3");
  const [purchasePriceGlobal, setPurchasePriceGlobal] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");

  const loadData = async () => {
    const [{ data: c }, { data: p }, { data: a }] = await Promise.all([
      supabase.from("product_categories").select("id, name").order("name"),
      supabase.from("products").select("id, name, sku, quantity, minimum_stock, purchase_price, selling_price, packaging_type, package_quantity, purchase_price_global, unit_cost_price, unit_profit, package_profit, category_id, is_active").order("name"),
      supabase.from("stock_alerts").select("id, message, alert_type, is_resolved, created_at").eq("is_resolved", false).order("created_at", { ascending: false }).limit(10),
    ]);
    setCategories((c || []) as Category[]);
    setProducts((p || []) as Product[]);
    setAlerts((a || []) as AlertRow[]);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setSku("");
    setCategoryId("");
    setPackagingType("custom");
    setPackageQuantity("1");
    setQuantity("0");
    setMinimumStock("3");
    setPurchasePriceGlobal("0");
    setSellingPrice("0");
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setSku(p.sku || "");
    setCategoryId(p.category_id || "");
    setPackagingType(p.packaging_type || "custom");
    setPackageQuantity(String(p.package_quantity || 1));
    setQuantity(String(p.quantity));
    setMinimumStock(String(p.minimum_stock));
    setPurchasePriceGlobal(String(p.purchase_price_global ?? p.purchase_price ?? 0));
    setSellingPrice(String(p.selling_price));
    setOpen(true);
  };

  const pricingPreview = useMemo(() => calculatePackagingEconomics({
    packagePurchasePrice: Number(purchasePriceGlobal || 0),
    packageQuantity: normalizePackagingQuantity(packageQuantity),
    unitSellingPrice: Number(sellingPrice || 0),
  }), [packageQuantity, purchasePriceGlobal, sellingPrice]);

  const saveProduct = async () => {
    if (!name.trim()) return toast.error("Nom produit requis");
    const packageQty = normalizePackagingQuantity(packageQuantity);
    const payload = {
      name: name.trim(),
      sku: sku.trim() || null,
      category_id: categoryId || null,
      quantity: Number(quantity || 0),
      minimum_stock: Number(minimumStock || 0),
      purchase_price: pricingPreview.unitCost,
      selling_price: Number(sellingPrice || 0),
      packaging_type: packagingType,
      package_quantity: packageQty,
      purchase_price_global: Number(purchasePriceGlobal || 0),
      unit_cost_price: pricingPreview.unitCost,
      unit_profit: pricingPreview.unitProfit,
      package_profit: pricingPreview.packageProfit,
      business_id: profile?.business_id,
    };

    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("products").insert([payload]);
      if (error) return toast.error(error.message);
    }

    toast.success("Produit enregistré.");
    setOpen(false);
    resetForm();
    void loadData();
  };

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || "").toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  return (
    <DashboardLayout role="salon_admin" title="Inventaire & Stock" subtitle="Produits, niveaux de stock et alertes" userName="Admin Studio">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <Input placeholder="Rechercher produit / SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-sm" />
            <Button onClick={openCreate}>Ajouter un produit</Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left p-3 text-xs">Produit</th>
                  <th className="text-left p-3 text-xs">SKU</th>
                  <th className="text-left p-3 text-xs">Stock</th>
                  <th className="text-left p-3 text-xs">Stock min</th>
                  <th className="text-left p-3 text-xs">Achat</th>
                  <th className="text-left p-3 text-xs">Vente</th>
                  <th className="text-right p-3 text-xs">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border">
                    <td className="p-3 text-sm font-medium">{p.name}</td>
                    <td className="p-3 text-sm">{p.sku || "-"}</td>
                    <td className="p-3 text-sm">{p.quantity}</td>
                    <td className="p-3 text-sm">{p.minimum_stock}</td>
                    <td className="p-3 text-sm">{p.purchase_price}</td>
                    <td className="p-3 text-sm">{p.selling_price}</td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Modifier</Button>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold mb-3">Alertes stock</h3>
            <div className="space-y-2">
              {alerts.length === 0 && <p className="text-sm text-muted-foreground">Aucune alerte active.</p>}
              {alerts.map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-muted/40 text-sm">
                  {a.message}
                </div>
              ))}
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[calc(100vh-1rem)] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier produit" : "Ajouter produit"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4">
              <div className="md:col-span-2">
                <Label>Nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Input type="number" min="1" value={packageQuantity} onChange={(e) => setPackageQuantity(e.target.value)} />
              </div>
              <div>
                <Label>Prix d'achat global</Label>
                <Input type="number" min="0" value={purchasePriceGlobal} onChange={(e) => setPurchasePriceGlobal(e.target.value)} />
              </div>
              <div>
                <Label>Coût unitaire calculé</Label>
                <Input type="number" value={pricingPreview.unitCost.toFixed(2)} readOnly />
              </div>
              <div>
                <Label>Prix vente unitaire</Label>
                <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
              </div>
              <div>
                <Label>Bénéfice unitaire</Label>
                <Input type="number" value={pricingPreview.unitProfit.toFixed(2)} readOnly />
              </div>
              <div>
                <Label>Bénéfice par conditionnement</Label>
                <Input type="number" value={pricingPreview.packageProfit.toFixed(2)} readOnly />
              </div>
              <div className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="font-semibold">Aperçu des marges</p>
                <p className="text-muted-foreground mt-1">
                  Coût unitaire: {pricingPreview.unitCost.toFixed(2)} | Profit unitaire: {pricingPreview.unitProfit.toFixed(2)} | Profit par conditionnement: {pricingPreview.packageProfit.toFixed(2)}
                </p>
              </div>
              <div>
                <Label>Quantité stock</Label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div>
                <Label>Stock minimum</Label>
                <Input type="number" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={saveProduct}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
