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
  const [quantity, setQuantity] = useState("0");
  const [minimumStock, setMinimumStock] = useState("3");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");

  const loadData = async () => {
    const [{ data: c }, { data: p }, { data: a }] = await Promise.all([
      supabase.from("product_categories").select("id, name").order("name"),
      supabase.from("products").select("id, name, sku, quantity, minimum_stock, purchase_price, selling_price, category_id, is_active").order("name"),
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
    setQuantity("0");
    setMinimumStock("3");
    setPurchasePrice("0");
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
    setQuantity(String(p.quantity));
    setMinimumStock(String(p.minimum_stock));
    setPurchasePrice(String(p.purchase_price));
    setSellingPrice(String(p.selling_price));
    setOpen(true);
  };

  const saveProduct = async () => {
    if (!name.trim()) return toast.error("Nom produit requis");
    const payload = {
      name: name.trim(),
      sku: sku.trim() || null,
      category_id: categoryId || null,
      quantity: Number(quantity || 0),
      minimum_stock: Number(minimumStock || 0),
      purchase_price: Number(purchasePrice || 0),
      selling_price: Number(sellingPrice || 0),
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
            <table className="w-full">
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
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier produit" : "Ajouter produit"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <Label>Quantité stock</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Stock minimum</Label>
              <Input type="number" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} />
            </div>
            <div>
              <Label>Prix achat</Label>
              <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div>
              <Label>Prix vente</Label>
              <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={saveProduct}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
