import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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
import { AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Pencil, Trash2, ShieldAlert, Pill, RefreshCw, Search } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data;
    return data.filter((p) =>
      [p.name, p.generic_name, p.barcode, p.form, p.category?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [data, searchQuery]);

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
      <AutoPartsPageHeader 
        title="Produits" 
        description={searchQuery.trim() ? `${filteredData.length} résultat(s) sur ${data.length} produit(s)` : `${data.length} produit(s) enregistré(s)`} 
        action={{ label: "Nouveau Produit", onClick: openCreate }} 
      />
      
      {data.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5 mt-6">
          <Pill className="h-12 w-12 text-primary mb-4 animate-bounce" />
          <h3 className="text-lg font-semibold mb-2">Votre catalogue de médicaments est vide</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Vous pouvez importer instantanément la liste standard de plus de 100 médicaments essentiels et 18 catégories recommandées pour commencer rapidement.
          </p>
          <Button onClick={handleImportCatalog} className="bg-primary hover:bg-primary-dark text-primary-fg gap-2 shadow-sm">
            <RefreshCw className="h-4 w-4" />
            Importer le catalogue standard
          </Button>
        </div>
      )}

      {data.length > 0 && (
        <>
          <div className="relative mb-6 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit (nom, DCI, code barre, forme, catégorie)..."
              className="h-12 pl-10 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center">
              <Search className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="font-semibold">Aucun produit trouvé</p>
              <p className="text-sm text-muted-foreground">
                Aucun résultat pour « {searchQuery} ».
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredData.map((r) => {
                const stock = Number(r.total_stock_quantity || 0);
                const min = Number(r.min_stock_alert || 0);
                const categoryColor = r.category?.color || "#07A278";
                const stockStyles =
                  stock <= 0
                    ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                    : stock <= min
                      ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                const stockLabel =
                  stock <= 0 ? "Rupture" : stock <= min ? "Stock faible" : "En stock";

                return (
                  <Card key={r.id} className="flex flex-col border-border/60 shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="flex flex-1 flex-col gap-4 p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${categoryColor}1a`, color: categoryColor }}
                        >
                          <Pill className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <h3 className="break-words text-base font-semibold leading-snug text-foreground">
                              {r.name}
                            </h3>
                            {r.requires_prescription && (
                              <ShieldAlert
                                className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                                aria-label="Ordonnance requise"
                              />
                            )}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {r.generic_name || "DCI non renseignée"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: `${categoryColor}20`,
                            color: categoryColor,
                          }}
                        >
                          {r.category?.name || "Non classé"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {r.form || "Forme non précisée"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Prix d'achat</p>
                          <p className="text-sm font-semibold">{format(r.cost_price || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Prix de vente</p>
                          <p className="text-sm font-semibold">{format(r.sale_price || 0)}</p>
                        </div>
                      </div>

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold ${stockStyles}`}>
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {stockLabel} · {stock}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Seuil min. {min}
                        </span>
                      </div>

                      <div className="flex gap-2 border-t border-border/60 pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Désactiver
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

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
