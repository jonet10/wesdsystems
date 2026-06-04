import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listPurchases, createPurchase, updatePurchaseStatus } from "@/modules/auto-parts/services/purchases";
import { listSuppliers } from "@/modules/auto-parts/services/suppliers";
import { searchProducts } from "@/modules/auto-parts/services/products";
import { AutoPartsDataTable, AutoPartsPageHeader } from "@/modules/auto-parts/components";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus, Trash2, Truck } from "lucide-react";
import type { AutoPartsPurchase, AutoPartsPurchaseItem, AutoPartsSupplier } from "@/modules/auto-parts/types";

const STATUS_LABELS: Record<string, string> = { draft: "Brouillon", pending: "En attente", confirmed: "Confirmée", preparing: "Préparation", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée" };
const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "outline", pending: "secondary", confirmed: "default", preparing: "default", shipped: "default", delivered: "default", cancelled: "destructive" };

export default function AutoPartsPurchasesPage() {
  const businessId = useAutoPartsBusinessId();
  const { format } = useCurrency();
  const [data, setData] = useState<(AutoPartsPurchase & { items: AutoPartsPurchaseItem[] })[]>([]);
  const [suppliers, setSuppliers] = useState<AutoPartsSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", supplier_name: "", reference_number: "", notes: "", items: [] as { product_id?: string; product_name: string; quantity: number; unit_price: number }[] });
  const [prodSearch, setProdSearch] = useState("");
  const [prodResults, setProdResults] = useState<{ id: string; name: string; sku: string | null }[]>([]);

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      setData(await listPurchases(businessId));
      setSuppliers(await listSuppliers());
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [businessId]);

  const searchProd = async (q: string) => {
    setProdSearch(q);
    if (!businessId || q.length < 1) { setProdResults([]); return; }
    try { setProdResults(await searchProducts(businessId, q)); } catch { }
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { product_name: "", quantity: 1, unit_price: 0 }] });
  };

  const updateItem = (i: number, field: string, value: any) => {
    const items = [...form.items];
    (items[i] as any)[field] = value;
    setForm({ ...form, items });
  };

  const removeItem = (i: number) => {
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  };

  const handleSave = async () => {
    if (!businessId) return;
    try {
      const subtotal = form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      await createPurchase(businessId, {
        supplier_id: form.supplier_id || null,
        supplier_name: form.supplier_name || null,
        reference_number: form.reference_number || undefined,
        status: "draft",
        subtotal,
        tax_amount: 0,
        total: subtotal,
        notes: form.notes || undefined,
        items: form.items,
      });
      toast.success("Achat créé");
      setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updatePurchaseStatus(id, status);
      toast.success(`Statut mis à jour: ${STATUS_LABELS[status]}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Achats" subtitle="Gestion des bons de commande fournisseurs">
      <StaggerContainer>
        <StaggerItem>
          <AutoPartsPageHeader title="Achats" description={`${data.length} commande(s)`} action={{ label: "Nouvel achat", onClick: () => { setForm({ supplier_id: "", supplier_name: "", reference_number: "", notes: "", items: [] }); setOpen(true); } }} />
          <AutoPartsDataTable
            rows={data}
            columns={[
              { key: "reference_number", label: "Réf.", render: (r) => r.reference_number || "-" },
              { key: "supplier_name", label: "Fournisseur", render: (r) => r.supplier_name || "-" },
              { key: "total", label: "Total", render: (r) => format(Number(r.total)) },
              { key: "status", label: "Statut", render: (r) => (
                <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v)}>
                  <SelectTrigger className="h-7 w-32"><Badge variant={STATUS_COLORS[r.status] || "outline"}>{STATUS_LABELS[r.status] || r.status}</Badge></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              )},
              { key: "created_at", label: "Date", render: (r) => new Date(r.created_at).toLocaleDateString("fr-FR") },
            ]}
          />
        </StaggerItem>
      </StaggerContainer>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouvel achat</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fournisseur</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Référence</Label>
                <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Articles</Label>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-end mb-2">
                  <div className="flex-1">
                    <Input placeholder="Rechercher..." value={prodSearch} onChange={(e) => searchProd(e.target.value)} onFocus={() => searchProd("")} />
                    {prodResults.length > 0 && (
                      <div className="border rounded-md mt-1 max-h-24 overflow-y-auto absolute z-10 bg-background shadow-lg">
                        {prodResults.map((p) => (
                          <div key={p.id} className="px-3 py-1.5 cursor-pointer hover:bg-muted text-sm" onClick={() => { updateItem(i, "product_id", p.id); updateItem(i, "product_name", p.name); setProdResults([]); setProdSearch(p.name); }}>
                            {p.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input type="number" className="w-20" placeholder="Qté" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                  <Input type="number" className="w-24" placeholder="Prix" step="0.01" value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", Number(e.target.value))} />
                  <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              ))}
              <p className="text-sm text-muted-foreground mt-1">Total: {format(form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0))}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave}>Créer la commande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
