import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Pencil, Trash2, ShieldAlert, Pill, RefreshCw } from "lucide-react";
import type { PharmacyProduct, PharmacyCategory } from "@/modules/pharmacy/types";
import { productService } from "@/modules/pharmacy/services/productService";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function PharmacyProducts() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const [data, setData] = useState<PharmacyProduct[]>([]);
  const [categories, setCategories] = useState<PharmacyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PharmacyProduct | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    generic_name: "",
    category_id: "",
    barcode: "",
    form: "",
    requires_prescription: false,
    min_stock_alert: "10",
    cost_price: "0",
    sale_price: "0"
  });

  const businessId = usePharmacyBusinessId();

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId]);

  const loadData = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        productService.getProducts(businessId),
        productService.getCategories(businessId)
      ]);
      setData(prods);
      setCategories(cats);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCatalog = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      await productService.importStandardCatalog(businessId);
      toast.success("Catalogue standard importé avec succès !");
      await loadData();
    } catch (e: any) {
      toast.error("Erreur lors de l'importation : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      generic_name: "",
      category_id: "",
      barcode: "",
      form: "Comprimé",
      requires_prescription: false,
      min_stock_alert: "10",
      cost_price: "0",
      sale_price: "0"
    });
    setOpen(true);
  };

  const openEdit = (p: PharmacyProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      generic_name: p.generic_name || "",
      category_id: p.category_id || "",
      barcode: p.barcode || "",
      form: p.form || "Comprimé",
      requires_prescription: p.requires_prescription,
      min_stock_alert: String(p.min_stock_alert),
      cost_price: String(p.cost_price || 0),
      sale_price: String(p.sale_price || 0)
    });
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
        min_stock_alert: Number(form.min_stock_alert || 0),
        cost_price: Number(form.cost_price || 0),
        sale_price: Number(form.sale_price || 0)
      };

      if (editing) {
        await productService.updateProduct(editing.id, payload);
        toast.success("Produit mis à jour");
      } else {
        await productService.createProduct(payload);
        toast.success("Produit créé");
      }
      setOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment désactiver ce produit ?")) return;
    try {
      await productService.deleteProduct(id);
      toast.success("Produit désactivé");
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Catalogue Médicaments" subtitle="Gestion des produits et médicaments">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader 
            title="Produits" 
            description={`${data.length} produit(s) enregistré(s)`} 
            action={{ label: "Nouveau Produit", onClick: openCreate }} 
          />
          
          {data.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-purple-500/20 rounded-2xl bg-purple-500/5 mt-6">
              <Pill className="h-12 w-12 text-purple-400 mb-4 animate-bounce" />
              <h3 className="text-lg font-semibold mb-2">Votre catalogue de médicaments est vide</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                Vous pouvez importer instantanément la liste standard de plus de 100 médicaments essentiels et 18 catégories recommandées pour commencer rapidement.
              </p>
              <Button onClick={handleImportCatalog} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                <RefreshCw className="h-4 w-4" />
                Importer le catalogue standard
              </Button>
            </div>
          )}

          {data.length > 0 && (
            <AutoPartsDataTable
              rows={data}
              columns={[
                { key: "name", label: "Nom du Produit", render: (r) => (
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {r.name}
                      {r.requires_prescription && <ShieldAlert className="w-4 h-4 text-red-500" title="Ordonnance requise" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.generic_name}</div>
                  </div>
                ) },
                { key: "category", label: "Catégorie", render: (r) => (
                  <span className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: `${r.category?.color || '#ccc'}20`, color: r.category?.color || '#666' }}>
                    {r.category?.name || "Non classé"}
                  </span>
                ) },
                { key: "form", label: "Forme", render: (r) => r.form || "-" },
                { key: "cost_price", label: "Prix d'Achat", render: (r) => format(r.cost_price || 0) },
                { key: "sale_price", label: "Prix de Vente", render: (r) => format(r.sale_price || 0) },
                { key: "stock", label: "Stock Total", render: (r) => (
                  <span className={r.total_stock_quantity <= r.min_stock_alert ? "text-red-500 font-bold" : "text-green-600 font-bold"}>
                    {r.total_stock_quantity}
                  </span>
                ) },
                { key: "actions", label: "Actions", render: (r) => (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                )},
              ]}
            />
          )}
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} Produit</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom Commercial *</Label>
              <Input placeholder="Ex: Doliprane 1000mg" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nom Générique (DCI)</Label>
              <Input placeholder="Ex: Paracétamol" value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.category")}</Label>
              <Select value={form.category_id} onValueChange={(val) => setForm({ ...form, category_id: val })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forme Galénique</Label>
              <Select value={form.form} onValueChange={(val) => setForm({ ...form, form: val })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Comprimé">Comprimé</SelectItem>
                  <SelectItem value="Gélule">Gélule</SelectItem>
                  <SelectItem value="Sirop">Sirop</SelectItem>
                  <SelectItem value="Injection">Injection</SelectItem>
                  <SelectItem value="Pommade">Pommade</SelectItem>
                  <SelectItem value="Suppositoire">Suppositoire</SelectItem>
                  <SelectItem value="Gouttes">Gouttes</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Code Barre</Label>
              <Input placeholder="Scanner ou taper..." value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
             <div className="space-y-2">
              <Label>Alerte Stock Minimum</Label>
              <Input type="number" value={form.min_stock_alert} onChange={(e) => setForm({ ...form, min_stock_alert: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Prix d'Achat</Label>
              <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Prix de Vente</Label>
              <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div className="col-span-2 flex items-center justify-between border p-4 rounded-lg mt-2">
              <div>
                <Label className="text-base">Sur Ordonnance Uniquement</Label>
                <p className="text-sm text-muted-foreground">Ce médicament nécessite-t-il une ordonnance pour être vendu ?</p>
              </div>
              <Switch checked={form.requires_prescription} onCheckedChange={(val) => setForm({ ...form, requires_prescription: val })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.name}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
