import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listProducts, listProductsFull, createProduct, updateProduct, deleteProduct } from "@/modules/auto-parts/services/products";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { listCategories } from "@/modules/auto-parts/services/categories";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Pencil, Trash2, Search } from "lucide-react";
import type { AutoPartsProduct, AutoPartsCategory } from "@/modules/auto-parts/types";

export default function AutoPartsProductsPage() {
  const { t } = useTranslation();
  const businessId = useAutoPartsBusinessId();
  const { format } = useCurrency();
  const { hasAutoPartsPermission, autoPartsStaffSession } = useAuth();
  const canManage = hasAutoPartsPermission(PERMISSIONS.PRODUCTS_MANAGE);
  const canViewCost = hasAutoPartsPermission(PERMISSIONS.COST_VIEW);
  const [data, setData] = useState<(AutoPartsProduct & { category: { name: string } | null })[]>([]);
  const [categories, setCategories] = useState<AutoPartsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoPartsProduct | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", category_id: "", sku: "", barcode: "",
    unit_price: "" as number | string, cost_price: "" as number | string, min_stock: 0 as number | string, max_stock: "" as number | string, location: "", notes: "", active: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      setData(await (canViewCost ? listProductsFull(businessId, autoPartsStaffSession?.session_token) : listProducts(businessId)));
      setCategories(await listCategories(businessId));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [businessId]);

  const filtered = data.filter((p) => {
    if (catFilter !== "all" && p.category_id !== catFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", category_id: "", sku: "", barcode: "", unit_price: "", cost_price: "", min_stock: "0", max_stock: "", location: "", notes: "", active: true });
    setOpen(true);
  };

  const openEdit = (p: AutoPartsProduct) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "", category_id: p.category_id ?? "",
      sku: p.sku ?? "", barcode: p.barcode ?? "", unit_price: p.unit_price?.toString() ?? "",
      cost_price: p.cost_price?.toString() ?? "", min_stock: p.min_stock?.toString() ?? "0", max_stock: p.max_stock?.toString() ?? "",
      location: p.location ?? "", notes: p.notes ?? "", active: p.active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    try {
      const values = {
        ...form,
        category_id: form.category_id || null,
        unit_price: form.unit_price === "" ? null : Number(form.unit_price),
        min_stock: Number(form.min_stock) || 0,
        max_stock: form.max_stock ? Number(form.max_stock) : null,
      };
      if (canViewCost) {
        (values as typeof values & { cost_price: number | null }).cost_price = form.cost_price === "" ? null : Number(form.cost_price);
      } else {
        delete (values as Partial<typeof values> & { cost_price?: unknown }).cost_price;
      }
      if (editing) { await updateProduct(editing.id, values, businessId); toast.success("Produit mis à jour"); }
      else { await createProduct(businessId, values); toast.success("Produit créé"); }
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    try { await deleteProduct(id, businessId); toast.success("Produit supprimé"); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Produits" subtitle="Gestion des pièces automobiles">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Produits" description={`${data.length} produit(s)`} action={canManage ? { label: "Nouveau produit", onClick: openCreate } : undefined} />
          
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <AutoPartsDataTable
            rows={filtered}
            columns={[
              { key: "name", label: "Nom" },
              { key: "sku", label: "SKU", render: (r) => r.sku || "-" },
              { key: "category", label: "Catégorie", render: (r) => r.category?.name ?? "-" },
              { key: "unit_price", label: "Prix vente", render: (r) => r.unit_price == null ? "-" : format(Number(r.unit_price)) },
              ...(canViewCost ? [{ key: "cost_price", label: "Prix revient", render: (r: AutoPartsProduct) => r.cost_price == null ? "-" : format(Number(r.cost_price)) }] : []),
              { key: "stock_quantity", label: "Stock", render: (r) => (
                <Badge variant={Number(r.stock_quantity) <= 0 ? "destructive" : Number(r.stock_quantity) <= Number(r.min_stock) ? "secondary" : "default"}>
                  {r.stock_quantity}
                </Badge>
              )},
              { key: "active", label: "Actif", render: (r) => r.active ? "Oui" : "Non" },
              ...(canManage ? [{ key: "actions", label: "Actions", render: (r: AutoPartsProduct) => (
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              )}] : []),
            ]}
          />
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} produit</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            <div className="col-span-2"><Label>{t("common.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-span-2"><Label>{t("common.description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>{t("common.category")}</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><Label>Code-barres</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
            <div><Label>Prix de vente</Label><Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
            {canViewCost && <div><Label>Prix de revient</Label><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>}
            <div><Label>Stock minimum</Label><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></div>
            <div><Label>Stock maximum</Label><Input type="number" value={form.max_stock} onChange={(e) => setForm({ ...form, max_stock: e.target.value })} /></div>
            <div className="col-span-2"><Label>Emplacement</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Produit actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
