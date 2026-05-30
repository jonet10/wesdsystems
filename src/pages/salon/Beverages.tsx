import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId, resolveBranchScope } from "@/lib/branch";
import { toast } from "sonner";
import {
  Beer, Search, Plus, Pencil, Trash2, Package, AlertTriangle,
  ArrowUpDown, History, Boxes
} from "lucide-react";

interface Beverage {
  id: string;
  branch_id: string;
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

export default function BeveragesPage() {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const branchScope = resolveBranchScope(profile?.business_id, branchId);
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [openStock, setOpenStock] = useState(false);
  const [editing, setEditing] = useState<Beverage | null>(null);
  const [stockAction, setStockAction] = useState<Beverage | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [costPrice, setCostPrice] = useState("0");
  const [unitsPerCase, setUnitsPerCase] = useState("24");
  const [stockCases, setStockCases] = useState("0");
  const [stockUnits, setStockUnits] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("50");

  const [addCases, setAddCases] = useState("1");
  const [addUnits, setAddUnits] = useState("0");

  const loadBeverages = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("salon_beverages")
        .select("*")
        .eq("is_active", true);
      if (branchScope) query = query.eq("branch_id", branchScope);
      const { data, error } = await query.order("name");
      if (error) throw error;
      setBeverages((data || []) as Beverage[]);
    } catch (err: any) {
      toast.error("Erreur chargement boissons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBeverages(); }, [branchScope]);

  const resetForm = () => {
    setEditing(null);
    setName(""); setBrand(""); setDescription(""); setSku(""); setBarcode("");
    setUnitPrice("0"); setCostPrice("0"); setUnitsPerCase("24");
    setStockCases("0"); setStockUnits("0"); setReorderLevel("50");
  };

  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (b: Beverage) => {
    setEditing(b);
    setName(b.name); setBrand(b.brand || ""); setDescription(b.description || "");
    setSku(b.sku || ""); setBarcode(b.barcode || "");
    setUnitPrice(String(b.unit_price)); setCostPrice(String(b.cost_price || 0));
    setUnitsPerCase(String(b.units_per_case));
    setStockCases(String(b.stock_cases)); setStockUnits(String(b.stock_units));
    setReorderLevel(String(b.reorder_level_units));
    setOpen(true);
  };

  const saveBeverage = async () => {
    if (!name.trim()) return toast.error("Nom requis");
    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,
      description: description.trim() || null,
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      unit_price: Number(unitPrice || 0),
      cost_price: Number(costPrice || 0) || null,
      units_per_case: Number(unitsPerCase || 24),
      stock_cases: Number(stockCases || 0),
      stock_units: Number(stockUnits || 0),
      reorder_level_units: Number(reorderLevel || 50),
    };

    try {
      if (editing) {
        const { error } = await supabase.from("salon_beverages").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Boisson modifiée");
      } else {
        const { error } = await supabase.from("salon_beverages").insert([{
          ...payload, branch_id: branchScope,
        }]);
        if (error) throw error;
        toast.success("Boisson ajoutée");
      }
      setOpen(false); resetForm(); loadBeverages();
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteBeverage = async (b: Beverage) => {
    try {
      const { error } = await supabase.from("salon_beverages")
        .update({ is_active: false }).eq("id", b.id);
      if (error) throw error;
      toast.success("Boisson supprimée");
      loadBeverages();
    } catch (err: any) { toast.error(err.message); }
  };

  const openStockDialog = (b: Beverage) => {
    setStockAction(b);
    setAddCases("1"); setAddUnits("0");
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
      setOpenStock(false); loadBeverages();
    } catch (err: any) { toast.error(err.message); }
  };

  const filtered = useMemo(() => {
    if (!search) return beverages;
    const q = search.toLowerCase();
    return beverages.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.brand || "").toLowerCase().includes(q) ||
      (b.sku || "").toLowerCase().includes(q)
    );
  }, [beverages, search]);

  const lowStock = beverages.filter(b => b.total_units_available <= b.reorder_level_units);

  const totalCases = beverages.reduce((s, b) => s + b.stock_cases, 0);
  const totalUnits = beverages.reduce((s, b) => s + b.total_units_available, 0);

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
    <DashboardLayout role="salon_admin" title="Boissons" subtitle="Gérez vos boissons avec la conversion automatique caisses/unités">
      <StaggerContainer className="space-y-6">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-72" />
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
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">Marque</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Par caisse</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Caisses</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Unités libres</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Total unités</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Prix unité</th>
                    <th className="text-right p-4 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                            <Beer className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{b.name}</p>
                            {b.brand && <p className="text-xs text-muted-foreground">{b.brand}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{b.brand || "—"}</td>
                      <td className="p-4 text-right font-medium">{b.units_per_case}</td>
                      <td className="p-4 text-right">
                        <span className="font-semibold">{b.stock_cases}</span>
                      </td>
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

      {/* Add/Edit Beverage Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la boisson" : "Nouvelle boisson"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="md:col-span-2">
              <Label>Nom *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Prestige Beer" />
            </div>
            <div>
              <Label>Marque</Label>
              <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ex: Brasserie Nationale" />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={sku} onChange={e => setSku(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Unités par caisse *</Label>
              <Input type="number" value={unitsPerCase} onChange={e => setUnitsPerCase(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Ex: 24 bouteilles par caisse</p>
            </div>
            <div>
              <Label>Seuil réapprovisionnement (unités)</Label>
              <Input type="number" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} />
            </div>
            <div>
              <Label>Caisses initiales</Label>
              <Input type="number" value={stockCases} onChange={e => setStockCases(e.target.value)} />
            </div>
            <div>
              <Label>Unités libres initiales</Label>
              <Input type="number" value={stockUnits} onChange={e => setStockUnits(e.target.value)} />
            </div>
            <div>
              <Label>Prix unitaire (vente) *</Label>
              <Input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
            </div>
            <div>
              <Label>Prix d'achat</Label>
              <Input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={saveBeverage}>{editing ? "Modifier" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Management Dialog */}
      <Dialog open={openStock} onOpenChange={setOpenStock}>
        <DialogContent className="sm:max-w-[400px]">
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
              <Input type="number" value={addCases} onChange={e => setAddCases(e.target.value)} min="0" />
              <p className="text-xs text-muted-foreground mt-1">
                1 caisse = {stockAction?.units_per_case} unités (conversion automatique)
              </p>
            </div>

            <div>
              <Label>Ajouter des unités libres</Label>
              <Input type="number" value={addUnits} onChange={e => setAddUnits(e.target.value)} min="0" />
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
