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

const TYPE_LABELS: Record<string, string> = { in: "Entrée", out: "Sortie", adjustment: "Ajustement", sale: "Vente", return: "Retour" };
const TYPE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = { in: "default", out: "destructive", adjustment: "secondary", sale: "destructive", return: "outline" };

export default function AutoPartsStockMovementsPage() {
  const businessId = useAutoPartsBusinessId();
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
          <AutoPartsPageHeader title="Mouvements" description={`${data.length} mouvement(s)`} action={{ label: "Nouveau mouvement", onClick: () => { setForm({ product_id: "", type: "in", quantity: 1, unit_price: "", reference: "", notes: "" }); setOpen(true); } }} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "product", label: "Produit", render: (r) => r.product?.name ?? "-" },
              { key: "type", label: "Type", render: (r) => <Badge variant={TYPE_COLORS[r.type] || "default"}>{TYPE_LABELS[r.type] || r.type}</Badge> },
              { key: "quantity", label: "Quantité", render: (r) => <span className={r.quantity > 0 ? "text-green-600" : "text-red-600"}>{r.quantity > 0 ? `+${r.quantity}` : r.quantity}</span> },
              { key: "reference", label: "Référence", render: (r) => r.reference || "-" },
              { key: "created_at", label: "Date", render: (r) => new Date(r.created_at).toLocaleString("fr-FR") },
            ]}
          />
        </StaggerItem>
      </StaggerContainer>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau mouvement de stock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produit</Label>
              <Input placeholder="Rechercher un produit..." value={productSearch} onChange={(e) => searchProd(e.target.value)} />
              {products.length > 0 && (
                <div className="border rounded-md mt-1 max-h-32 overflow-y-auto">
                  {products.map((p) => (
                    <div key={p.id} className={`px-3 py-2 cursor-pointer hover:bg-muted text-sm ${form.product_id === p.id ? "bg-primary/10" : ""}`} onClick={() => { setForm({ ...form, product_id: p.id }); setProducts([]); setProductSearch(p.name); }}>
                      {p.name} ({p.sku || "N/A"})
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrée</SelectItem>
                  <SelectItem value="out">Sortie</SelectItem>
                  <SelectItem value="adjustment">Ajustement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantité</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Prix unitaire (optionnel)</Label>
              <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
            </div>
            <div>
              <Label>Référence</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
