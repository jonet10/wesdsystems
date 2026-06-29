import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listDeliveryNotes, createDeliveryNote, deleteDeliveryNote, getDeliveryNote } from "@/modules/auto-parts/services/deliveryNotes";
import { searchProducts } from "@/modules/auto-parts/services/products";
import { searchClients } from "@/modules/auto-parts/services/clients";
import { getBusinessSettings } from "@/modules/auto-parts/services/businessSettings";
import DeliveryNoteDocument from "@/modules/auto-parts/components/DeliveryNoteDocument";
import { toast } from "sonner";
import { Plus, Search, Eye, Trash2 } from "lucide-react";
import type { DeliveryNote, DeliveryNoteItem } from "@/modules/auto-parts/services/deliveryNotes";

const statusBadge = (status: string) => {
  const map: Record<string, string> = { draft: "secondary", delivered: "success", cancelled: "destructive" };
  const labels: Record<string, string> = { draft: "Brouillon", delivered: "Livré", cancelled: "Annulé" };
  return <Badge variant={(map[status] || "secondary") as any}>{labels[status] || status}</Badge>;
};

export default function AutoPartsDeliveryNotesPage() {
  const { t } = useTranslation();
  const businessId = useAutoPartsBusinessId();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [viewing, setViewing] = useState<DeliveryNote | null>(null);
  const [business, setBusiness] = useState<any>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [status, setStatus] = useState("draft");
  const [notesText, setNotesText] = useState("");
  const [items, setItems] = useState<DeliveryNoteItem[]>([]);
  const [clientResults, setClientResults] = useState<{ id: string; name: string }[]>([]);
  const [productResults, setProductResults] = useState<{ id: string; name: string }[][]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const [data, biz] = await Promise.all([
          listDeliveryNotes(businessId),
          getBusinessSettings(businessId).catch(() => null),
        ]);
        setNotes(data);
        setBusiness(biz);
      } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
    })();
  }, [businessId]);

  const searchClient = async (q: string) => {
    setClientName(q);
    if (q.length < 1) { setClientResults([]); return; }
    try { setClientResults(await searchClients(q, businessId)); } catch {}
  };

  const searchProduct = async (q: string, idx: number) => {
    if (q.length < 1) { setProductResults((r) => { const c = [...r]; c[idx] = []; return c; }); return; }
    try {
      const res = await searchProducts(businessId, q);
      setProductResults((r) => { const c = [...r]; c[idx] = res as any; return c; });
    } catch {}
  };

  const addItem = () => {
    setItems((prev) => [...prev, { product_name: "", quantity: 1, unit: "pce" }]);
    setProductResults((r) => [...r, []]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setProductResults((r) => r.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<DeliveryNoteItem>) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  };

  const openNew = () => {
    setClientName(""); setClientPhone(""); setClientAddress("");
    setStatus("draft"); setNotesText("");
    setItems([]); setProductResults([]);
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!businessId || items.length === 0) { toast.error("Ajoutez au moins un article"); return; }
    setSaving(true);
    try {
      const result = await createDeliveryNote(businessId, {
        client_name: clientName || undefined,
        client_phone: clientPhone || undefined,
        client_address: clientAddress || undefined,
        status,
        notes: notesText || undefined,
        prefix: business?.delivery_note_prefix || "BL-",
        items,
      });
      toast.success(`BL ${result.delivery_note_number} créé`);
      setShowForm(false);
      setNotes(await listDeliveryNotes(businessId));
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce bon de livraison ?")) return;
    try {
      await deleteDeliveryNote(id, businessId);
      toast.success("BL supprimé");
      setNotes(await listDeliveryNotes(businessId));
    } catch (e: any) { toast.error(e.message); }
  };

  const viewNote = async (note: DeliveryNote) => {
    if (note.items && note.items.length > 0) { setViewing(note); setShowView(true); return; }
    try {
      const full = await getDeliveryNote(note.id, businessId);
      setViewing(full);
      setShowView(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = notes.filter((n) =>
    !searchQ ||
    n.delivery_note_number.toLowerCase().includes(searchQ.toLowerCase()) ||
    n.client_name?.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <DashboardLayout role="salon_admin" title="Bons de livraison" subtitle="Gestion des bons de livraison">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Numéro ou client..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-10" />
            </div>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nouveau BL</Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">N° BL</th>
                    <th className="p-3 font-medium">{t("common.client")}</th>
                    <th className="p-3 font-medium">{t("common.date")}</th>
                    <th className="p-3 font-medium">Articles</th>
                    <th className="p-3 font-medium">{t("common.status")}</th>
                    <th className="p-3 font-medium text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n) => (
                    <tr key={n.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">{n.delivery_note_number}</td>
                      <td className="p-3">{n.client_name || "Client divers"}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3">{n.items?.length || 0}</td>
                      <td className="p-3">{statusBadge(n.status)}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => viewNote(n)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(n.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucun bon de livraison trouvé</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nouveau bon de livraison</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] px-1">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Label>{t("common.client")}</Label>
                  <Input value={clientName} onChange={(e) => searchClient(e.target.value)} />
                  {clientResults.length > 0 && (
                    <div className="absolute z-10 w-full border rounded-md mt-1 bg-background shadow-lg max-h-32 overflow-y-auto">
                      {clientResults.map((c) => (
                        <div key={c.id} className="px-3 py-2 cursor-pointer hover:bg-muted text-sm"
                          onClick={() => { setClientName(c.name); setClientResults([]); }}>
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label>{t("common.phone")}</Label>
                  <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Adresse</Label>
                  <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
                </div>
                <div>
                  <Label>{t("common.status")}</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="delivered">Livré</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Articles</Label>
                  <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start mb-2">
                    <div className="flex-1 relative">
                      <Input value={item.product_name} placeholder="Article"
                        onChange={(e) => { updateItem(idx, { product_name: e.target.value }); searchProduct(e.target.value, idx); }} />
                      {(productResults[idx] || []).length > 0 && (
                        <div className="absolute z-10 w-full border rounded-md mt-1 bg-background shadow-lg max-h-32 overflow-y-auto">
                          {productResults[idx].map((p) => (
                            <div key={p.id} className="px-3 py-2 cursor-pointer hover:bg-muted text-sm"
                              onClick={() => { updateItem(idx, { product_id: p.id, product_name: p.name }); setProductResults((r) => { const c = [...r]; c[idx] = []; return c; }); }}>
                              {p.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-20">
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="mt-1"><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                ))}
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Création..." : "Créer le BL"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / PDF Dialog */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>BL {viewing?.delivery_note_number}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            {viewing && (
              <DeliveryNoteDocument
                data={{
                  delivery_note_number: viewing.delivery_note_number,
                  created_at: viewing.created_at,
                  delivered_at: viewing.delivered_at,
                  client_name: viewing.client_name,
                  client_phone: viewing.client_phone,
                  client_address: viewing.client_address,
                  status: viewing.status,
                  notes: viewing.notes,
                  items: (viewing.items || []).map((i) => ({
                    product_name: i.product_name,
                    quantity: i.quantity,
                    unit: i.unit,
                  })),
                }}
                business={{
                  company_name: business?.company_name || "PIÈCES AUTO",
                  logo_url: business?.logo_url,
                  address: business?.address,
                  phone: business?.phone,
                  email: business?.email,
                  nif: business?.nif,
                }}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
