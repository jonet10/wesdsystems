import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { useStationeryPermissions } from "@/modules/stationery/hooks/useStationeryPermissions";
import { listInventoryAdjustments, createInventoryAdjustment } from "@/modules/stationery/services/inventory";
import { listProducts } from "@/modules/stationery/services/products";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { Loader2, Plus, ArrowUpRight, ArrowDownRight, RefreshCcw, Search } from "lucide-react";
import type { StationeryProduct } from "@/modules/stationery/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function StationeryInventoryPage() {
  const { t } = useTranslation();
  const businessId = useStationeryBusinessId();
  const { hasStationeryPermission } = useStationeryPermissions();
  const canManage = hasStationeryPermission(PERMISSIONS.STOCK_MANAGE);
  
  const [data, setData] = useState<any[]>([]);
  const [products, setProducts] = useState<StationeryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    product_id: "", type: "add" as "add"|"remove"|"set", quantity: 1, reason: "Restock", notes: ""
  });

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [adj, prods] = await Promise.all([
        listInventoryAdjustments(businessId, null),
        listProducts(businessId, null)
      ]);
      setData(adj);
      setProducts(prods);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  
  useEffect(() => { load(); }, [businessId]);

  const filtered = data.filter((item) => {
    if (search && !item.stationery_products?.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setForm({ product_id: "", type: "add", quantity: 1, reason: "Restock", notes: "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!businessId || !form.product_id || form.quantity <= 0) return;
    try {
      setSaving(true);
      await createInventoryAdjustment(businessId, "", form); // branchId empty string uses hook internal logic
      toast.success("Stock ajusté avec succès");
      setOpen(false); 
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const getReasonLabel = (reason: string) => {
    const reasons: Record<string, string> = {
      "Restock": "Réapprovisionnement",
      "Correction": "Correction d'inventaire",
      "Loss": "Perte / Casse",
      "Return": "Retour client"
    };
    return reasons[reason] || reason;
  };

  return (
    <DashboardLayout role="salon_admin" title="Inventaire" subtitle="Mouvements et ajustements de stock">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Historique des Mouvements</h2>
              <p className="text-muted-foreground">Tracez toutes les entrées et sorties de stock</p>
            </div>
            {canManage && (
              <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700">
                <Plus className="mr-2 h-4 w-4" />
                Ajustement de Stock
              </Button>
            )}
          </div>
          
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par produit..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Aucun ajustement enregistré</TableCell></TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {format(new Date(r.adjustment_date), "dd MMM yyyy HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        {r.type === 'add' ? (
                          <div className="flex items-center text-green-600 font-medium">
                            <ArrowUpRight className="h-4 w-4 mr-1" /> Entrée
                          </div>
                        ) : r.type === 'remove' ? (
                          <div className="flex items-center text-red-600 font-medium">
                            <ArrowDownRight className="h-4 w-4 mr-1" /> Sortie
                          </div>
                        ) : (
                          <div className="flex items-center text-blue-600 font-medium">
                            <RefreshCcw className="h-4 w-4 mr-1" /> Défini à
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{r.stationery_products?.name || "Produit inconnu"}</p>
                          <p className="text-xs text-muted-foreground">{r.stationery_products?.sku || r.stationery_products?.barcode}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getReasonLabel(r.reason)}</TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {r.type === 'add' ? '+' : r.type === 'remove' ? '-' : ''}{r.quantity}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={r.notes}>
                        {r.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvel Ajustement de Stock</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Produit</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Rechercher un produit..." /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (Stock actuel: {p.stock_quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type d'opération</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Ajouter au stock (+)</SelectItem>
                    <SelectItem value="remove">Retirer du stock (-)</SelectItem>
                    <SelectItem value="set">Définir le stock (=)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantité</Label>
                <Input type="number" min={1} className="mt-1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
            </div>

            <div>
              <Label>Motif</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Restock">Réapprovisionnement</SelectItem>
                  <SelectItem value="Correction">Correction d'inventaire</SelectItem>
                  <SelectItem value="Loss">Perte / Casse / Vol</SelectItem>
                  <SelectItem value="Return">Retour client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes (Optionnel)</Label>
              <Textarea className="mt-1" placeholder="Détails supplémentaires..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.product_id || form.quantity <= 0}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</> : "Valider l'ajustement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
