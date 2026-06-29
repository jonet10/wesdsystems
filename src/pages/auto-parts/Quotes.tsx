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
import { listQuotes, createQuote, updateQuote, deleteQuote } from "@/modules/auto-parts/services/quotes";
import { searchProducts } from "@/modules/auto-parts/services/products";
import { searchClients } from "@/modules/auto-parts/services/clients";
import { getBusinessSettings } from "@/modules/auto-parts/services/businessSettings";
import QuoteDocument from "@/modules/auto-parts/components/QuoteDocument";
import { toast } from "sonner";
import { Plus, Search, Eye, Pencil, Trash2, FileText } from "lucide-react";
import type { Quote, QuoteItem } from "@/modules/auto-parts/services/quotes";

const fmt = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "HTG", minimumFractionDigits: 2 });

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    draft: "secondary", sent: "default", accepted: "success",
    refused: "destructive", converted: "default", expired: "outline",
  };
  const labels: Record<string, string> = {
    draft: "Brouillon", sent: "Envoyé", accepted: "Accepté",
    refused: "Refusé", converted: "Facturé", expired: "Expiré",
  };
  return <Badge variant={(map[status] || "secondary") as any}>{labels[status] || status}</Badge>;
};

interface FormState {
  client_id: string | null;
  client_name: string;
  client_phone: string;
  client_email: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  total: number;
  valid_until: string;
  notes: string;
  terms: string;
  items: QuoteItem[];
}

const emptyForm = (): FormState => ({
  client_id: null, client_name: "", client_phone: "", client_email: "",
  subtotal: 0, tax_rate: 0, tax_amount: 0,
  discount_type: "none", discount_value: 0, discount_amount: 0, total: 0,
  valid_until: "", notes: "", terms: "",
  items: [{ product_name: "", quantity: 1, unit_price: 0 }],
});

export default function AutoPartsQuotesPage() {
  const { t } = useTranslation();
  const businessId = useAutoPartsBusinessId();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Quote | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [business, setBusiness] = useState<any>(null);
  const [clientResults, setClientResults] = useState<{ id: string; name: string }[]>([]);
  const [productResults, setProductResults] = useState<{ id: string; name: string; unit_price: number }[][]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const [data, biz] = await Promise.all([
          listQuotes(businessId),
          getBusinessSettings(businessId).catch(() => null),
        ]);
        setQuotes(data);
        setBusiness(biz);
        if (biz?.quote_prefix) setForm((f) => ({ ...f }));
      } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
    })();
  }, [businessId]);

  const recalc = (f: FormState) => {
    const subtotal = f.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
    const discountAmount = f.discount_type === "percentage" ? subtotal * (f.discount_value / 100) : f.discount_type === "fixed" ? Math.min(f.discount_value, subtotal) : 0;
    const taxAmount = (subtotal - discountAmount) * (f.tax_rate / 100);
    const total = subtotal - discountAmount + taxAmount;
    return { ...f, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total };
  };

  const updateForm = (patch: Partial<FormState>) => setForm((f) => recalc({ ...f, ...patch }));

  const searchClient = async (q: string) => {
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
    setForm((f) => recalc({ ...f, items: [...f.items, { product_name: "", quantity: 1, unit_price: 0 }] }));
    setProductResults((r) => [...r, []]);
  };

  const removeItem = (idx: number) => {
    setForm((f) => recalc({ ...f, items: f.items.filter((_, i) => i !== idx) }));
    setProductResults((r) => r.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<QuoteItem>) => {
    setForm((f) => {
      const items = f.items.map((item, i) => i === idx ? { ...item, ...patch } : item);
      return recalc({ ...f, items });
    });
  };

  const selectProduct = (idx: number, prod: { id: string; name: string; unit_price: number }) => {
    updateItem(idx, { product_id: prod.id, product_name: prod.name, unit_price: prod.unit_price });
    setProductResults((r) => { const c = [...r]; c[idx] = []; return c; });
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setProductResults([]);
    setShowForm(true);
  };

  const openEdit = (quote: Quote) => {
    setEditingId(quote.id);
    setForm({
      client_id: quote.client_id ?? null,
      client_name: quote.client_name ?? "",
      client_phone: quote.client_phone ?? "",
      client_email: quote.client_email ?? "",
      subtotal: quote.subtotal,
      tax_rate: quote.tax_rate,
      tax_amount: quote.tax_amount,
      discount_type: quote.discount_type,
      discount_value: quote.discount_value,
      discount_amount: quote.discount_amount,
      total: quote.total,
      valid_until: quote.valid_until?.split("T")[0] ?? "",
      notes: quote.notes ?? "",
      terms: quote.terms ?? "",
      items: (quote.items || []).map((i) => ({ ...i })),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateQuote(editingId, form, businessId);
        toast.success("Devis mis à jour");
      } else {
        const result = await createQuote(businessId, {
          ...form,
          quote_prefix: business?.quote_prefix || "DEV-",
        });
        toast.success(`Devis ${result.quote_number} créé`);
      }
      setShowForm(false);
      setQuotes(await listQuotes(businessId));
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce devis ?")) return;
    try {
      await deleteQuote(id, businessId);
      toast.success("Devis supprimé");
      setQuotes(await listQuotes(businessId));
    } catch (e: any) { toast.error(e.message); }
  };

  const viewQuote = async (quote: Quote) => {
    if (quote.items && quote.items.length > 0) {
      setViewing(quote);
      setShowView(true);
      return;
    }
    try {
      const full = await getQuote(quote.id, businessId);
      setViewing(full);
      setShowView(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = quotes.filter((q) =>
    !searchQ ||
    q.quote_number.toLowerCase().includes(searchQ.toLowerCase()) ||
    q.client_name?.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <DashboardLayout role="salon_admin" title="Devis" subtitle="Gestion des devis">
      <StaggerContainer>
        <StaggerItem>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Numéro ou client..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-10" />
            </div>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nouveau devis</Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">N° Devis</th>
                    <th className="p-3 font-medium">{t("common.client")}</th>
                    <th className="p-3 font-medium">{t("common.date")}</th>
                    <th className="p-3 font-medium text-right">{t("common.total")}</th>
                    <th className="p-3 font-medium">{t("common.status")}</th>
                    <th className="p-3 font-medium text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((q) => (
                    <tr key={q.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">{q.quote_number}</td>
                      <td className="p-3">{q.client_name || "Client divers"}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3 text-right font-medium">{fmt(q.total)}</td>
                      <td className="p-3">{statusBadge(q.status)}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => viewQuote(q)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(q.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucun devis trouvé</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier le devis" : "Nouveau devis"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] px-1">
            <div className="space-y-6">
              {/* Client */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Label>{t("common.client")}</Label>
                  <Input value={form.client_name} onChange={(e) => { updateForm({ client_name: e.target.value }); searchClient(e.target.value); }} />
                  {clientResults.length > 0 && (
                    <div className="absolute z-10 w-full border rounded-md mt-1 bg-background shadow-lg max-h-32 overflow-y-auto">
                      {clientResults.map((c) => (
                        <div key={c.id} className="px-3 py-2 cursor-pointer hover:bg-muted text-sm"
                          onClick={() => { updateForm({ client_id: c.id, client_name: c.name }); setClientResults([]); }}>
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Téléphone client</Label>
                  <Input value={form.client_phone} onChange={(e) => updateForm({ client_phone: e.target.value })} />
                </div>
                <div>
                  <Label>Email client</Label>
                  <Input value={form.client_email} onChange={(e) => updateForm({ client_email: e.target.value })} />
                </div>
                <div>
                  <Label>Valable jusqu'au</Label>
                  <Input type="date" value={form.valid_until} onChange={(e) => updateForm({ valid_until: e.target.value })} />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Articles</Label>
                  <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
                </div>
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start mb-2">
                    <div className="flex-1 relative">
                      <Input value={item.product_name} placeholder="Article"
                        onChange={(e) => { updateItem(idx, { product_name: e.target.value }); searchProduct(e.target.value, idx); }} />
                      {(productResults[idx] || []).length > 0 && (
                        <div className="absolute z-10 w-full border rounded-md mt-1 bg-background shadow-lg max-h-32 overflow-y-auto">
                          {productResults[idx].map((p) => (
                            <div key={p.id} className="px-3 py-2 cursor-pointer hover:bg-muted text-sm"
                              onClick={() => selectProduct(idx, p)}>
                              {p.name} - {fmt(p.unit_price)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-20">
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                    </div>
                    <div className="w-28">
                      <Input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} />
                    </div>
                    <div className="w-28 pt-2 text-sm text-right font-medium">
                      {fmt((item.quantity || 0) * (item.unit_price || 0))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="mt-1"><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                ))}
              </div>

              {/* Discount, Tax */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{t("common.discount")}</Label>
                  <div className="flex gap-2">
                    <Select value={form.discount_type} onValueChange={(v: string) => updateForm({ discount_type: v, discount_value: 0 })}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="fixed">{t("common.amount")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.discount_type !== "none" && (
                      <Input type="number" className="w-24" value={form.discount_value} onChange={(e) => updateForm({ discount_value: Number(e.target.value) })} />
                    )}
                  </div>
                </div>
                <div>
                  <Label>TVA (%)</Label>
                  <Input type="number" value={form.tax_rate} onChange={(e) => updateForm({ tax_rate: Number(e.target.value) })} className="w-24" />
                </div>
                <div className="text-right pt-6">
                  <p className="text-sm">Sous-total: <strong>{fmt(form.subtotal)}</strong></p>
                  {form.discount_amount > 0 && <p className="text-sm text-red-600">Remise: -{fmt(form.discount_amount)}</p>}
                  {form.tax_amount > 0 && <p className="text-sm">TVA: {fmt(form.tax_amount)}</p>}
                  <p className="text-lg font-bold">Total: {fmt(form.total)}</p>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} placeholder="Notes pour le client" />
                </div>
                <div>
                  <Label>Conditions</Label>
                  <Textarea value={form.terms} onChange={(e) => updateForm({ terms: e.target.value })} placeholder="Conditions générales" />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Sauvegarde..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / PDF Dialog */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Devis {viewing?.quote_number}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            {viewing && (
              <QuoteDocument
                data={{
                  quote_number: viewing.quote_number,
                  created_at: viewing.created_at,
                  valid_until: viewing.valid_until,
                  client_name: viewing.client_name,
                  client_phone: viewing.client_phone,
                  client_email: viewing.client_email,
                  subtotal: viewing.subtotal,
                  tax_rate: viewing.tax_rate,
                  tax_amount: viewing.tax_amount,
                  discount_type: viewing.discount_type,
                  discount_value: viewing.discount_value,
                  discount_amount: viewing.discount_amount,
                  total: viewing.total,
                  status: viewing.status,
                  notes: viewing.notes,
                  terms: viewing.terms,
                  items: (viewing.items || []).map((i) => ({
                    product_name: i.product_name,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    total_price: i.total_price ?? i.quantity * i.unit_price,
                  })),
                }}
                business={{
                  company_name: business?.company_name || "PIÈCES AUTO",
                  logo_url: business?.logo_url,
                  address: business?.address,
                  phone: business?.phone,
                  email: business?.email,
                  nif: business?.nif,
                  patente: business?.patente,
                  rc: business?.rc,
                  bank_name: business?.bank_name,
                  bank_account: business?.bank_account,
                }}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
