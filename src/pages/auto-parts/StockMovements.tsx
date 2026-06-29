import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listStockMovements, createStockMovement } from "@/modules/auto-parts/services/stock-movements";
import { searchProducts } from "@/modules/auto-parts/services/products";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { toast } from "sonner";
import { Package } from "lucide-react";
import type { AutoPartsStockMovement } from "@/modules/auto-parts/types";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";

const TYPE_LABELS: Record<string, string> = { in: "Entrée", out: "Sortie", adjustment: "Ajustement", sale: "Vente", return: "Retour" };
const TYPE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = { in: "default", out: "destructive", adjustment: "secondary", sale: "outline", return: "outline" };

export default function AutoPartsStockMovementsPage() {
  const { t } = useTranslation();
  const businessId = useAutoPartsBusinessId();
  const { hasAutoPartsPermission } = useAuth();
  const canManage = hasAutoPartsPermission(PERMISSIONS.STOCK_MANAGE);
  const [data, setData] = useState<(AutoPartsStockMovement & { product: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string; sku: string | null }[]>([]);
  const [form, setForm] = useState({ product_id: "", type: "in" as "in" | "out" | "adjustment", quantity: 1, unit_price: "", reference: "", notes: "" });

  const load = async () => {
    setLoading(true);
    try { setData(await listStockMovements(businessId)); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [businessId]);

  const searchProd = async (q: string) => {
    setProductSearch(q);
    if (q.length < 1) { setProducts([]); return; }
    try { setProducts(await searchProducts(businessId, q)); } catch { }
  };

  const handleSave = async () => {
    if (!businessId) return;
    try {
      await createStockMovement(businessId, {
        product_id: form.product_id,
        type: form.type,
        quantity: form.type === "out" ? -Math.abs(form.quantity) : form.quantity,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Mouvement enregistré");
      setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Mouvements de stock" subtitle="Historique des entrées/sorties">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Mouvements" description={`${data.length} mouvement(s)`} action={canManage ? { label: "Nouveau mouvement", onClick: () => { setForm({ product_id: "", type: "in", quantity: 1, unit_price: "", reference: "", notes: "" }); setOpen(true); } } : undefined} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "product", label: "Produit", render: (r) => <span className="font-medium">{r.product?.name ?? "-"}</span> },
              { key: "type", label: "Type", render: (r) => <Badge variant={TYPE_COLORS[r.type] || "default"}>{TYPE_LABELS[r.type] || r.type}</Badge> },
              { key: "quantity", label: "Quantité", render: (r) => <span className={`font-semibold ${r.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{r.quantity > 0 ? `+${r.quantity}` : r.quantity}</span> },
              { key: "reference", label: "Référence", render: (r) => r.reference || "-" },
              { key: "created_at", label: "Date", render: (r) => new Date(r.created_at).toLocaleString("fr-FR") },
            ]}
          />
        </StaggerItem>
      </StaggerContainer>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md sm:rounded-[24px] border-slate-200 dark:border-cyan-400/20 shadow-2xl dark:shadow-[0_0_50px_rgba(34,211,238,0.15)] bg-white/95 dark:bg-[#0A0A0F]/95 backdrop-blur-2xl dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-cyan-500 dark:from-violet-400 dark:to-cyan-300 bg-clip-text text-transparent">
              Nouveau mouvement de stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Produit</Label>
              <Input className="mt-1.5 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-11 dark:text-white" placeholder="Rechercher un produit..." value={productSearch} onChange={(e) => searchProd(e.target.value)} />
              {products.length > 0 && (
                <div className="border border-slate-200 dark:border-white/10 rounded-xl mt-2 max-h-40 overflow-y-auto bg-white dark:bg-[#12121a] shadow-lg">
                  {products.map((p) => (
                    <div key={p.id} className={`px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 text-sm transition-colors ${form.product_id === p.id ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium" : "dark:text-slate-300"}`} onClick={() => { setForm({ ...form, product_id: p.id }); setProducts([]); setProductSearch(p.name); }}>
                      {p.name} <span className="opacity-50 text-xs ml-1">({p.sku || "N/A"})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Type</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="mt-1.5 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="dark:bg-[#12121a] dark:border-white/10 dark:text-white">
                    <SelectItem value="in">Entrée</SelectItem>
                    <SelectItem value="out">Sortie</SelectItem>
                    <SelectItem value="adjustment">Ajustement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Quantité</Label>
                <Input className="mt-1.5 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-11 dark:text-white" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Prix unitaire (optionnel)</Label>
                <Input className="mt-1.5 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-11 dark:text-white" type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Référence</Label>
                <Input className="mt-1.5 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-11 dark:text-white" placeholder="Ex: BL-2026..." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Notes</Label>
              <Input className="mt-1.5 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-11 dark:text-white" placeholder="Raison de l'ajustement..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-between">
            <Button variant="ghost" className="rounded-xl h-11 flex-1 dark:text-slate-300 dark:hover:bg-white/5" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} className="rounded-xl h-11 flex-1 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-lg shadow-violet-500/25 border-0 font-medium transition-all">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
