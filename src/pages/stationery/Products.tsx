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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { useStationeryPermissions } from "@/modules/stationery/hooks/useStationeryPermissions";
import { listProducts, createProduct, updateProduct, deleteProduct } from "@/modules/stationery/services/products";
import { PERMISSIONS } from "@/config/permissions";
import { listCategories } from "@/modules/stationery/services/categories";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Loader2, Plus } from "lucide-react";
import type { StationeryProduct, StationeryCategory } from "@/modules/stationery/types";

export default function StationeryProductsPage() {
  const { t } = useTranslation();
  const businessId = useStationeryBusinessId();
  const { format } = useCurrency();
  const { hasStationeryPermission } = useStationeryPermissions();
  const canManage = hasStationeryPermission(PERMISSIONS.PRODUCTS_MANAGE);
  const canViewCost = hasStationeryPermission(PERMISSIONS.COST_VIEW);
  const [data, setData] = useState<(StationeryProduct & { category: { name: string } | null })[]>([]);
  const [categories, setCategories] = useState<StationeryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StationeryProduct | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", category_id: "", sku: "", barcode: "",
    selling_price: "" as number | string, purchase_price: "" as number | string, 
    stock_quantity: 0 as number | string, min_stock_alert: 5 as number | string, 
    selling_unit: "unité", active: true,
  });

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      setData(await listProducts(businessId, null));
      setCategories(await listCategories(businessId, null));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  
  useEffect(() => { load(); }, [businessId]);

  const filtered = data.filter((p) => {
    if (catFilter !== "all" && p.category_id !== catFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku?.toLowerCase().includes(search.toLowerCase()) && !p.barcode?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ 
      name: "", description: "", category_id: "", sku: "", barcode: "", 
      selling_price: "", purchase_price: "", stock_quantity: "0", min_stock_alert: "5", 
      selling_unit: "unité", active: true 
    });
    setOpen(true);
  };

  const openEdit = (p: StationeryProduct) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "", category_id: p.category_id ?? "",
      sku: p.sku ?? "", barcode: p.barcode ?? "", 
      selling_price: p.selling_price?.toString() ?? "",
      purchase_price: p.purchase_price?.toString() ?? "", 
      stock_quantity: p.stock_quantity?.toString() ?? "0", 
      min_stock_alert: p.min_stock_alert?.toString() ?? "5",
      selling_unit: p.selling_unit ?? "unité", active: p.active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    try {
      setSaving(true);
      const values = {
        ...form,
        category_id: form.category_id || null,
        selling_price: form.selling_price === "" ? 0 : Number(form.selling_price),
        purchase_price: form.purchase_price === "" ? 0 : Number(form.purchase_price),
        stock_quantity: Number(form.stock_quantity) || 0,
        min_stock_alert: Number(form.min_stock_alert) || 5,
      };
      
      if (!canViewCost) {
        delete (values as any).purchase_price;
      }

      if (editing) { 
        await updateProduct(editing.id, values, businessId); 
        toast.success("Produit mis à jour"); 
      } else { 
        await createProduct(businessId, "", values); // branchId required normally, we'll fix later
        toast.success("Produit créé"); 
      }
      setOpen(false); 
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce produit ?")) return;
    try { 
      await deleteProduct(id, businessId); 
      toast.success("Produit supprimé"); 
      load(); 
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Produits (Papeterie)" subtitle="Gestion des fournitures et articles">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Produits</h2>
              <p className="text-muted-foreground">{data.length} produit(s) en catalogue</p>
            </div>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau produit
              </Button>
            )}
          </div>
          
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, SKU ou Code-barres..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Toutes les catégories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><span>Toutes les catégories</span></SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}><span>{c.name}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>SKU/Code-barres</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Prix vente</TableHead>
                  {canViewCost && <TableHead>Prix achat</TableHead>}
                  <TableHead>Stock</TableHead>
                  <TableHead>Unité</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Aucun produit trouvé</TableCell></TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <div className="text-xs">{r.sku || "-"}</div>
                        <div className="text-xs text-muted-foreground">{r.barcode || ""}</div>
                      </TableCell>
                      <TableCell>{r.category?.name ?? "-"}</TableCell>
                      <TableCell>{format(Number(r.selling_price))}</TableCell>
                      {canViewCost && <TableCell>{format(Number(r.purchase_price))}</TableCell>}
                      <TableCell>
                        <Badge variant={Number(r.stock_quantity) <= 0 ? "destructive" : Number(r.stock_quantity) <= Number(r.min_stock_alert) ? "secondary" : "default"}>
                          {r.stock_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.selling_unit}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} produit</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="col-span-2"><Label>Nom du produit *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            
            <div>
              <Label>Catégorie</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Unité de vente</Label>
              <Select value={form.selling_unit} onValueChange={(v) => setForm({ ...form, selling_unit: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unité">Unité</SelectItem>
                  <SelectItem value="paquet">Paquet</SelectItem>
                  <SelectItem value="boîte">Boîte</SelectItem>
                  <SelectItem value="douzaine">Douzaine</SelectItem>
                  <SelectItem value="carton">Carton</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div><Label>SKU (Référence interne)</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><Label>Code-barres (EAN/UPC)</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
            
            <div><Label>Prix de vente *</Label><Input type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required /></div>
            {canViewCost && <div><Label>Prix d'achat</Label><Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></div>}
            
            <div><Label>Stock actuel</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} disabled={!!editing} title={editing ? "Utilisez le module Inventaire pour ajuster le stock existant" : ""} /></div>
            <div><Label>Alerte stock minimum</Label><Input type="number" value={form.min_stock_alert} onChange={(e) => setForm({ ...form, min_stock_alert: e.target.value })} /></div>
            
            <div className="col-span-2 flex items-center gap-2 mt-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Produit actif à la vente</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || form.selling_price === ""}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
