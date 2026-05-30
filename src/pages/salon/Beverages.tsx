import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId, resolveBranchScope } from "@/lib/branch";
import { toast } from "sonner";
import {
  Beer,
  Search,
  Plus,
  Pencil,
  Trash2,
  Package,
  AlertTriangle,
  Boxes,
  Download,
  Sparkles,
} from "lucide-react";
import { SearchableSelect } from "@/components/shared/SearchableSelect";

interface Beverage {
  id: string;
  branch_id: string;
  master_beverage_id?: string | null;
  catalog_category_id?: string | null;
  is_custom?: boolean;
  name: string;
  brand?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unit_price: number;
  cost_price?: number;
  units_per_case: number;
  stock_cases: number;
  stock_units: number;
  total_units_available: number;
  reorder_level_units: number;
  is_active: boolean;
}

interface MasterCategory {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

interface MasterBeverage {
  id: string;
  category_id: string;
  brand_id?: string | null;
  name: string;
  brand?: string | null;
  sku?: string | null;
  description?: string | null;
  units_per_case: number;
  image_url?: string | null;
  active: boolean;
}

const emptyForm = {
  categoryId: "",
  beverageId: "",
  customBeverage: false,
  name: "",
  brand: "",
  description: "",
  sku: "",
  barcode: "",
  unitPrice: "0",
  costPrice: "0",
  unitsPerCase: "24",
  stockCases: "0",
  stockUnits: "0",
  reorderLevel: "50",
};

export default function BeveragesPage() {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const branchScope = resolveBranchScope(profile?.business_id, branchId);
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
  const [masterBeverages, setMasterBeverages] = useState<MasterBeverage[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [openStock, setOpenStock] = useState(false);
  const [editing, setEditing] = useState<Beverage | null>(null);
  const [stockAction, setStockAction] = useState<Beverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [addCases, setAddCases] = useState("1");
  const [addUnits, setAddUnits] = useState("0");

  const loadBeverages = async () => {
    try {
      setLoading(true);
      const [beverageRes, categoryRes, masterBeverageRes] = await Promise.all([
        supabase
          .from("salon_beverages")
          .select("*")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("master_beverage_categories")
          .select("id, name, slug, active")
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("master_beverages")
          .select("id, category_id, brand_id, name, brand, sku, description, units_per_case, image_url, active")
          .eq("active", true)
          .order("sort_order"),
      ]);

      if (beverageRes.error) throw beverageRes.error;
      if (categoryRes.error) throw categoryRes.error;
      if (masterBeverageRes.error) throw masterBeverageRes.error;

      setBeverages((beverageRes.data || []) as Beverage[]);
      setMasterCategories((categoryRes.data || []) as MasterCategory[]);
      setMasterBeverages((masterBeverageRes.data || []) as MasterBeverage[]);
    } catch (err: any) {
      toast.error(err.message || "Erreur chargement boissons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBeverages();
  }, [branchScope]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const hydrateFromMaster = (masterId: string) => {
    const selected = masterBeverages.find((item) => item.id === masterId);
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      beverageId: masterId,
      name: selected.name,
      brand: selected.brand || "",
      sku: selected.sku || "",
      description: selected.description || "",
      unitsPerCase: String(selected.units_per_case || 24),
      customBeverage: false,
    }));
  };

  const openEdit = (b: Beverage) => {
    setEditing(b);
    const master = b.master_beverage_id ? masterBeverages.find((item) => item.id === b.master_beverage_id) : null;
    setForm({
      categoryId: b.catalog_category_id || master?.category_id || "",
      beverageId: b.master_beverage_id || "",
      customBeverage: b.is_custom ?? !b.master_beverage_id,
      name: b.name,
      brand: b.brand || master?.brand || "",
      description: b.description || master?.description || "",
      sku: b.sku || master?.sku || "",
      barcode: b.barcode || "",
      unitPrice: String(b.unit_price),
      costPrice: String(b.cost_price || 0),
      unitsPerCase: String(b.units_per_case),
      stockCases: String(b.stock_cases),
      stockUnits: String(b.stock_units),
      reorderLevel: String(b.reorder_level_units),
    });
    setOpen(true);
  };

  const saveBeverage = async () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    if (!form.customBeverage && !form.beverageId) return toast.error("Sélectionnez une boisson du catalogue");
    if (!form.categoryId) return toast.error("Catégorie requise");

    const payload = {
      master_beverage_id: form.customBeverage ? null : form.beverageId || null,
      catalog_category_id: form.categoryId || null,
      is_custom: form.customBeverage,
      sku: form.sku.trim() || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      brand: form.brand.trim() || null,
      catalog_brand: form.brand.trim() || null,
      barcode: form.barcode.trim() || null,
      unit_price: Number(form.unitPrice || 0),
      cost_price: Number(form.costPrice || 0) || null,
      units_per_case: Number(form.unitsPerCase || 24),
      stock_cases: Number(form.stockCases || 0),
      stock_units: Number(form.stockUnits || 0),
      reorder_level_units: Number(form.reorderLevel || 50),
    };

    try {
      if (editing) {
        const { error } = await supabase.from("salon_beverages").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Boisson modifiée");
      } else {
        const { error } = await supabase.from("salon_beverages").insert([{
          ...payload,
          branch_id: branchScope,
        }]);
        if (error) throw error;
        toast.success("Boisson ajoutée");
      }
      setOpen(false);
      resetForm();
      await loadBeverages();
    } catch (err: any) {
      toast.error(err.message || "Impossible d'enregistrer la boisson");
    }
  };

  const deleteBeverage = async (b: Beverage) => {
    try {
      const { error } = await supabase.from("salon_beverages").update({ is_active: false }).eq("id", b.id);
      if (error) throw error;
      toast.success("Boisson supprimée");
      await loadBeverages();
    } catch (err: any) {
      toast.error(err.message || "Impossible de supprimer la boisson");
    }
  };

  const openStockDialog = (b: Beverage) => {
    setStockAction(b);
    setAddCases("1");
    setAddUnits("0");
    setOpenStock(true);
  };

  const addStock = async () => {
    if (!stockAction) return;
    const cases = Number(addCases || 0);
    const units = Number(addUnits || 0);
    if (cases === 0 && units === 0) return toast.error("Ajoutez au moins 1 caisse ou unité");

    try {
      const { error } = await supabase
        .from("salon_beverages")
        .update({
          stock_cases: stockAction.stock_cases + cases,
          stock_units: stockAction.stock_units + units,
        })
        .eq("id", stockAction.id);
      if (error) throw error;
      toast.success(`Stock mis à jour: +${cases} caisse(s), +${units} unité(s)`);
      setOpenStock(false);
      await loadBeverages();
    } catch (err: any) {
      toast.error(err.message || "Impossible de mettre à jour le stock");
    }
  };

  const importCatalog = async () => {
    if (!branchScope) return toast.error("Sélectionnez une branche");
    setImporting(true);
    try {
      const { data, error } = await supabase.rpc("import_standard_beverage_catalog", {
        p_branch_id: branchScope,
        p_include_salon_products: true,
      });
      if (error) throw error;
      toast.success(`${data || 0} boisson(s) importée(s) depuis le catalogue.`);
      await loadBeverages();
    } catch (err: any) {
      toast.error(err.message || "Impossible d'importer le catalogue");
    } finally {
      setImporting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return beverages;
    const q = search.toLowerCase();
    return beverages.filter((b) =>
      [
        b.name,
        b.brand,
        b.sku,
        b.description,
      ].some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [beverages, search]);

  const lowStock = beverages.filter((b) => b.total_units_available <= b.reorder_level_units);
  const totalCases = beverages.reduce((s, b) => s + b.stock_cases, 0);
  const totalUnits = beverages.reduce((s, b) => s + b.total_units_available, 0);
  const categoryOptions = masterCategories.map((category) => ({
    value: category.id,
    label: category.name,
    description: category.slug,
  }));
  const beverageOptions = masterBeverages
    .filter((item) => !form.categoryId || item.category_id === form.categoryId)
    .map((item) => ({
      value: item.id,
      label: item.name,
      description: [item.brand, item.sku].filter(Boolean).join(" · ") || undefined,
    }));

  if (loading) {
    return (
      <DashboardLayout role="salon_admin" title="Boissons" subtitle="Gestion des boissons">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="salon_admin" title="Boissons" subtitle="Catalogue global et gestion des stocks">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total boissons</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{beverages.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Caisses en stock</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{totalCases}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unités disponibles</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{totalUnits}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Catalogue</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{masterBeverages.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{masterCategories.length} catégories disponibles</p>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Import catalogue standard
              </div>
              <p className="text-sm text-muted-foreground">
                Remplissez votre branche avec les boissons haïtiennes préconfigurées en un clic.
              </p>
            </div>
            <Button onClick={importCatalog} disabled={importing || !branchScope} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {importing ? "Import..." : "Importer le catalogue"}
            </Button>
          </div>
        </StaggerItem>

        {lowStock.length > 0 && (
          <StaggerItem>
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{lowStock.length} boisson(s) en stock faible</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Certaines boissons sont sous le seuil de réapprovisionnement.
                </p>
              </div>
            </div>
          </StaggerItem>
        )}

        <StaggerItem>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-72" />
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Nouvelle boisson
            </Button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">Boisson</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">Origine</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Par caisse</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Caisses</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Unités libres</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Total unités</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Prix unité</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                            <Beer className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{b.name}</p>
                            <p className="text-xs text-muted-foreground">{b.brand || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant={b.is_custom ? "secondary" : "default"}>{b.is_custom ? "Custom" : "Catalogue"}</Badge>
                      </td>
                      <td className="p-4 text-right font-medium">{b.units_per_case}</td>
                      <td className="p-4 text-right"><span className="font-semibold">{b.stock_cases}</span></td>
                      <td className="p-4 text-right">{b.stock_units}</td>
                      <td className="p-4 text-right">
                        <Badge variant={b.total_units_available <= b.reorder_level_units ? "destructive" : "secondary"}>
                          {b.total_units_available}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-medium">{format(b.unit_price)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => openStockDialog(b)}>
                            <Boxes className="h-3 w-3" /> Stock
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBeverage(b)}>
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
                <Beer className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Aucune boisson trouvée</p>
              </div>
            )}
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la boisson" : "Nouvelle boisson"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Créer une boisson custom</p>
                <p className="text-xs text-muted-foreground">Désactivez le catalogue pour saisir les données manuellement.</p>
              </div>
              <Switch
                checked={form.customBeverage}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, customBeverage: checked, beverageId: checked ? "" : prev.beverageId }))}
              />
            </div>

            {!form.customBeverage && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie *</Label>
                  <SearchableSelect
                    value={form.categoryId}
                    onValueChange={(value) => {
                      setForm((prev) => ({ ...prev, categoryId: value, beverageId: "" }));
                    }}
                    options={categoryOptions}
                    placeholder="Choisir une catégorie"
                    searchPlaceholder="Rechercher une catégorie"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beverage *</Label>
                  <SearchableSelect
                    value={form.beverageId}
                    onValueChange={hydrateFromMaster}
                    options={beverageOptions}
                    placeholder={form.categoryId ? "Choisir une boisson" : "Sélectionnez d'abord une catégorie"}
                    searchPlaceholder="Rechercher une boisson"
                    disabled={!form.categoryId}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nom *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  readOnly={!form.customBeverage}
                />
              </div>
              <div>
                <Label>Marque</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
                  readOnly={!form.customBeverage}
                />
              </div>
              <div>
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
                  readOnly={!form.customBeverage}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  readOnly={!form.customBeverage}
                />
              </div>
              <div>
                <Label>Barcode</Label>
                <Input
                  value={form.barcode}
                  onChange={(e) => setForm((prev) => ({ ...prev, barcode: e.target.value }))}
                  readOnly={!form.customBeverage}
                />
              </div>
              <div>
                <Label>Unités par caisse</Label>
                <Input
                  type="number"
                  value={form.unitsPerCase}
                  onChange={(e) => setForm((prev) => ({ ...prev, unitsPerCase: e.target.value }))}
                  readOnly={!form.customBeverage}
                />
              </div>
              <div>
                <Label>Prix unitaire (vente)</Label>
                <Input value={form.unitPrice} onChange={(e) => setForm((prev) => ({ ...prev, unitPrice: e.target.value }))} type="number" />
              </div>
              <div>
                <Label>Prix d'achat</Label>
                <Input value={form.costPrice} onChange={(e) => setForm((prev) => ({ ...prev, costPrice: e.target.value }))} type="number" />
              </div>
              <div>
                <Label>Caisses initiales</Label>
                <Input value={form.stockCases} onChange={(e) => setForm((prev) => ({ ...prev, stockCases: e.target.value }))} type="number" />
              </div>
              <div>
                <Label>Unités libres initiales</Label>
                <Input value={form.stockUnits} onChange={(e) => setForm((prev) => ({ ...prev, stockUnits: e.target.value }))} type="number" />
              </div>
              <div>
                <Label>Seuil réapprovisionnement</Label>
                <Input value={form.reorderLevel} onChange={(e) => setForm((prev) => ({ ...prev, reorderLevel: e.target.value }))} type="number" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={saveBeverage}>{editing ? "Modifier" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openStock} onOpenChange={setOpenStock}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Ajouter du stock — {stockAction?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted/40 rounded-lg p-3 text-sm">
              <p>Configuration actuelle :</p>
              <p className="font-semibold">{stockAction?.units_per_case} unités par caisse</p>
              <p className="text-muted-foreground">
                Stock actuel : {stockAction?.stock_cases} caisses / {stockAction?.stock_units} unités libres
                = <strong>{stockAction?.total_units_available} unités</strong> disponibles
              </p>
            </div>
            <div>
              <Label>Ajouter des caisses</Label>
              <Input type="number" value={addCases} onChange={(e) => setAddCases(e.target.value)} min="0" />
              <p className="text-xs text-muted-foreground mt-1">
                1 caisse = {stockAction?.units_per_case} unités (conversion automatique)
              </p>
            </div>
            <div>
              <Label>Ajouter des unités libres</Label>
              <Input type="number" value={addUnits} onChange={(e) => setAddUnits(e.target.value)} min="0" />
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <p className="font-semibold">Aperçu après ajout :</p>
              <p>
                Caisses : {(stockAction?.stock_cases || 0) + Number(addCases || 0)} |
                Unités libres : {(stockAction?.stock_units || 0) + Number(addUnits || 0)} |
                Total : {(stockAction?.stock_cases || 0) * (stockAction?.units_per_case || 24) + (stockAction?.stock_units || 0) + Number(addCases || 0) * (stockAction?.units_per_case || 24) + Number(addUnits || 0)} unités
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenStock(false)}>Annuler</Button>
            <Button onClick={addStock}>
              <Package className="h-4 w-4 mr-2" /> Ajouter au stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
