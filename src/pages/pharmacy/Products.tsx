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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Pencil, Trash2, ShieldAlert, Pill, RefreshCw, Search, TrendingUp, CheckSquare, Square, Percent } from "lucide-react";
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
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PharmacyProduct | null>(null);

  // Bulk margin states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marginDialogOpen, setMarginDialogOpen] = useState(false);
  const [marginPercent, setMarginPercent] = useState<string>("30");
  const [roundUpPrice, setRoundUpPrice] = useState<boolean>(true);
  const [isApplyingMargin, setIsApplyingMargin] = useState(false);
  
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

  const calculatedFormMargin = useMemo(() => {
    const cost = Number(form.cost_price || 0);
    const sale = Number(form.sale_price || 0);
    if (cost > 0 && sale > 0) {
      const margin = ((sale - cost) / cost) * 100;
      return margin.toFixed(1);
    }
    return null;
  }, [form.cost_price, form.sale_price]);

  const applyMarginToForm = (percentage: number) => {
    const cost = Number(form.cost_price || 0);
    if (cost <= 0) {
      toast.warning("Veuillez d'abord renseigner un prix d'achat supérieur à 0.");
      return;
    }
    let newSale = cost * (1 + percentage / 100);
    newSale = Number(newSale.toFixed(2));
    setForm((prev) => ({ ...prev, sale_price: String(newSale) }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map((p) => p.id));
    }
  };

  const selectedProducts = useMemo(() => {
    return data.filter((p) => selectedIds.includes(p.id));
  }, [data, selectedIds]);

  const handleApplyBulkMargin = async () => {
    const margin = parseFloat(marginPercent);
    if (isNaN(margin) || margin < 0) {
      toast.error("Veuillez saisir un pourcentage de marge valide (ex: 15, 30 ou 40).");
      return;
    }

    if (selectedProducts.length === 0) {
      toast.error("Aucun produit sélectionné.");
      return;
    }

    setIsApplyingMargin(true);
    try {
      const updates = selectedProducts.map((p) => {
        const cost = Number(p.cost_price || 0);
        let newPrice = cost * (1 + margin / 100);
        if (roundUpPrice) {
          newPrice = Math.ceil(newPrice);
        } else {
          newPrice = Number(newPrice.toFixed(2));
        }
        return {
          id: p.id,
          sale_price: newPrice,
        };
      });

      await productService.updateBulkPrices(updates);
      toast.success(
        `Marge de ${margin}% appliquée avec succès à ${updates.length} médicament(s) !`
      );
      setMarginDialogOpen(false);
      setSelectedIds([]);
      await loadData();
    } catch (err: any) {
      toast.error("Erreur lors de l'application de la marge : " + err.message);
    } finally {
      setIsApplyingMargin(false);
    }
  };

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
    if (!businessId) {
      setLoading(false);
      return;
    }
    loadData();
  }, [businessId]);

  const loadData = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const [prods, cats] = await Promise.all([
        productService.getProducts(businessId),
        productService.getCategories(businessId)
      ]);
      setData(prods);
      setCategories(cats);
    } catch (e: any) {
      setLoadError(e?.message || "Impossible de charger les produits.");
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
      
      {loading && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-xl border border-dashed border-border p-10 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Chargement des produits...
        </div>
      )}

      {!loading && loadError && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Impossible de charger les produits</p>
            <p className="text-sm">{loadError}</p>
          </div>
          <Button variant="outline" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </Button>
        </div>
      )}

      {data.length === 0 && !loading && !loadError && (
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
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un produit (nom, DCI, code barre, forme, catégorie)..."
                  className="h-12 pl-10 text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={toggleSelectAll}
                  className="gap-2 text-sm h-11"
                >
                  {selectedIds.length === filteredData.length && filteredData.length > 0 ? (
                    <>
                      <CheckSquare className="w-4 h-4 text-primary" />
                      Tout désélectionner
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      Tout sélectionner ({filteredData.length})
                    </>
                  )}
                </Button>

                {selectedIds.length > 0 && (
                  <Button
                    onClick={() => setMarginDialogOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 shadow-sm h-11"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Fixer marge % ({selectedIds.length})
                  </Button>
                )}
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm font-medium animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {selectedIds.length}
                  </span>
                  <span>médicament(s) sélectionné(s) pour ajustement tarifaire</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setMarginDialogOpen(true)}
                    className="h-8 gap-1.5 font-bold"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Appliquer marge %
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds([])}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Annuler sélection
                  </Button>
                </div>
              </div>
            )}
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
                const isSelected = selectedIds.includes(r.id);
                const stockStyles =
                  stock <= 0
                    ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                    : stock <= min
                      ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                const stockLabel =
                  stock <= 0 ? "Rupture" : stock <= min ? "Stock faible" : "En stock";

                const cost = Number(r.cost_price || 0);
                const sale = Number(r.sale_price || 0);
                const currentMargin = cost > 0 && sale > 0 ? (((sale - cost) / cost) * 100).toFixed(0) : null;

                return (
                  <Card 
                    key={r.id} 
                    className={`flex flex-col border-border/60 shadow-sm transition-all hover:shadow-md ${
                      isSelected ? "ring-2 ring-primary border-primary bg-primary/5" : ""
                    }`}
                  >
                    <CardContent className="flex flex-1 flex-col gap-3.5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(r.id)}
                            className="h-5 w-5 data-[state=checked]:bg-primary"
                          />
                        </div>
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
                          <p className="text-sm font-semibold">{format(cost)}</p>
                        </div>
                        <div>
                          <div className="flex justify-between items-baseline">
                            <p className="text-xs text-muted-foreground">Prix de vente</p>
                            {currentMargin && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                +{currentMargin}%
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-primary">{format(sale)}</p>
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
              <Input 
                type="number" 
                step="0.01" 
                value={form.cost_price} 
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Prix de Vente</Label>
                {calculatedFormMargin && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${Number(calculatedFormMargin) >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600"}`}>
                    Marge : {Number(calculatedFormMargin) > 0 ? `+${calculatedFormMargin}%` : `${calculatedFormMargin}%`}
                  </span>
                )}
              </div>
              <Input 
                type="number" 
                step="0.01" 
                value={form.sale_price} 
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })} 
              />
            </div>

            <div className="col-span-2 rounded-lg bg-muted/40 p-3 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" /> Fixer par pourcentage de marge :
                </span>
                <span className="text-[11px] text-muted-foreground">
                  (calculé sur le prix d'achat)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[15, 20, 25, 30, 40, 50, 100].map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-bold"
                    onClick={() => applyMarginToForm(pct)}
                  >
                    +{pct}%
                  </Button>
                ))}
              </div>
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

      {/* DIALOGUE POUR DEFINIR LA MARGE EN POURCENTAGE SUR 1 OU PLUSIEURS PRODUITS */}
      <Dialog open={marginDialogOpen} onOpenChange={setMarginDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Définir le prix de vente par pourcentage de marge
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Appliquer un taux de marge bénéficiaire sur le prix d'achat pour{" "}
              <strong className="text-foreground">{selectedIds.length}</strong> médicament(s) sélectionné(s).
            </p>

            <div className="space-y-2">
              <Label>Pourcentage de marge souhaité (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Ex: 40"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(e.target.value)}
                  className="text-lg font-bold"
                />
                <span className="text-lg font-bold text-muted-foreground px-1">%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Raccourcis en un clic :</Label>
              <div className="flex flex-wrap gap-2">
                {[10, 15, 20, 25, 30, 40, 50, 100].map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    variant={marginPercent === String(pct) ? "default" : "outline"}
                    size="sm"
                    className="font-bold text-xs"
                    onClick={() => setMarginPercent(String(pct))}
                  >
                    +{pct}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border p-3 rounded-lg bg-muted/20">
              <div>
                <Label className="text-sm font-semibold">Arrondir le prix à l'entier supérieur</Label>
                <p className="text-xs text-muted-foreground">Ex: 114,40 G deviendra 115,00 G</p>
              </div>
              <Switch checked={roundUpPrice} onCheckedChange={setRoundUpPrice} />
            </div>

            {/* Aperçu dynamique */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground border-b flex justify-between">
                <span>Aperçu des prix calculés ({selectedProducts.length} produit{selectedProducts.length > 1 ? "s" : ""})</span>
                <span>Prix Achat ➔ Nouveau Prix Vente</span>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-border/50 text-xs">
                {selectedProducts.slice(0, 8).map((p) => {
                  const cost = Number(p.cost_price || 0);
                  const margin = parseFloat(marginPercent) || 0;
                  let newPrice = cost * (1 + margin / 100);
                  if (roundUpPrice) newPrice = Math.ceil(newPrice);
                  else newPrice = Number(newPrice.toFixed(2));
                  const profit = newPrice - cost;

                  return (
                    <div key={p.id} className="p-2.5 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold truncate text-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">Prix actuel : {format(p.sale_price || 0)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary">
                          {format(cost)} ➔ {format(newPrice)}
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Bénéfice : +{format(profit)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {selectedProducts.length > 8 && (
                  <div className="p-2 text-center text-muted-foreground text-[11px] bg-muted/20">
                    ... et {selectedProducts.length - 8} autre(s) médicament(s)
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarginDialogOpen(false)} disabled={isApplyingMargin}>
              Annuler
            </Button>
            <Button onClick={handleApplyBulkMargin} disabled={isApplyingMargin || !marginPercent} className="gap-2">
              <TrendingUp className="w-4 h-4" />
              {isApplyingMargin ? "Application..." : `Appliquer à ${selectedIds.length} produit(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
