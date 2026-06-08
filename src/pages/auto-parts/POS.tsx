import { useState, useEffect, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAutoPartsBusinessId } from "@/modules/auto-parts/hooks/useAutoPartsBusinessId";
import { listProducts, searchProducts } from "@/modules/auto-parts/services/products";
import { listCategories } from "@/modules/auto-parts/services/categories";
import { searchClients } from "@/modules/auto-parts/services/clients";
import { createSale } from "@/modules/auto-parts/services/sales";
import { listStaff } from "@/modules/auto-parts/services/staff";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { printReceipt } from "@/lib/print-utils";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Trash2, Search, User, CreditCard, Banknote, X, Percent, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutoPartsProduct, AutoPartsCategory, AutoPartsStaff } from "@/modules/auto-parts/types";

interface CartItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export default function AutoPartsPOSPage() {
  const businessId = useAutoPartsBusinessId();
  const { format } = useCurrency();
  const { autoPartsStaffSession } = useAuth();
  const [products, setProducts] = useState<(AutoPartsProduct & { category: { name: string } | null })[]>([]);
  const [categories, setCategories] = useState<AutoPartsCategory[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discountType, setDiscountType] = useState<"none" | "percentage" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastSale, setLastSale] = useState<{ id: string; invoice_number: string } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [staff, setStaff] = useState<AutoPartsStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [receiptSnapshot, setReceiptSnapshot] = useState<{
    cart: CartItem[]; subtotal: number; discountAmount: number;
    taxRate: number; taxAmount: number; total: number;
    paymentMethod: string; selectedClient: { id: string; name: string } | null;
    staffName: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setProducts(await listProducts(businessId) as any);
        setCategories(await listCategories(businessId));
        const staffList = await listStaff(businessId);
        setStaff(staffList);
        if (autoPartsStaffSession) {
          setSelectedStaff(autoPartsStaffSession.id);
        }
      } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
    })();
  }, [businessId, autoPartsStaffSession]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (!p.active) return false;
      if (catFilter !== "all" && p.category_id !== catFilter) return false;
      if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase()) && !p.sku?.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    });
  }, [products, catFilter, searchQ]);

  const addToCart = (p: AutoPartsProduct) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: Number(p.unit_price) }];
    });
  };

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => prev.map((i, ix) => ix === idx ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };

  const removeFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, ix) => ix !== idx));
  };

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.quantity * i.unit_price, 0), [cart]);
  const discountAmount = useMemo(() => {
    if (discountType === "percentage") return subtotal * (discountValue / 100);
    if (discountType === "fixed") return Math.min(discountValue, subtotal);
    return 0;
  }, [subtotal, discountType, discountValue]);
  const taxAmount = useMemo(() => (subtotal - discountAmount) * (taxRate / 100), [subtotal, discountAmount, taxRate]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);

  const searchClient = async (q: string) => {
    setClientSearch(q);
    if (q.length < 1) { setClientResults([]); return; }
    try { setClientResults(await searchClients(q)); } catch { }
  };

  const handlePayment = async () => {
    if (!businessId || cart.length === 0) return;
    const staffMember = staff.find(s => s.id === selectedStaff) || (autoPartsStaffSession ? { name: autoPartsStaffSession.name } as AutoPartsStaff : undefined);
    try {
      const sale = await createSale(businessId, {
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        total,
        payment_method: paymentMethod,
        payment_status: "paid",
        client_id: selectedClient?.id ?? null,
        client_name: selectedClient?.name ?? undefined,
        staff_id: selectedStaff || null,
        items: cart,
      });
      setReceiptSnapshot({
        cart: [...cart],
        subtotal,
        discountAmount,
        taxRate,
        taxAmount,
        total,
        paymentMethod,
        selectedClient: selectedClient ? { ...selectedClient } : null,
        staffName: staffMember?.name || "",
      });
      setLastSale({ id: sale.id, invoice_number: sale.invoice_number });
      setCart([]);
      setSelectedClient(null);
      setSelectedStaff("");
      setDiscountType("none");
      setDiscountValue(0);
      setTaxRate(0);
      setShowPayment(false);
      setShowReceipt(true);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Point de vente" subtitle="Caisse auto-parts">
      <div className="flex gap-4 h-[calc(100vh-8rem)]">
        {/* Left: Products */}
        <div className="flex-1 flex flex-col">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-10" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((p) => (
                <Card key={p.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => addToCart(p)}>
                  <CardContent className="p-4">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-lg font-bold text-primary">{format(Number(p.unit_price))}</p>
                    <Badge variant={Number(p.stock_quantity) <= 0 ? "destructive" : "secondary"} className="mt-1">
                      {p.stock_quantity} en stock
                    </Badge>
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && <p className="col-span-full text-center text-muted-foreground py-12">Aucun produit trouvé</p>}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Cart */}
        <div className="w-96 flex flex-col border-l pl-4">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-5 w-5" />
            <h2 className="font-semibold">Panier ({cart.length})</h2>
          </div>

          {/* Client selection */}
          <div className="mb-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Client (optionnel)..." value={clientSearch} onChange={(e) => searchClient(e.target.value)} className="pl-10" />
              {clientResults.length > 0 && (
                <div className="absolute z-10 w-full border rounded-md mt-1 bg-background shadow-lg max-h-32 overflow-y-auto">
                  {clientResults.map((c) => (
                    <div key={c.id} className="px-3 py-2 cursor-pointer hover:bg-muted text-sm" onClick={() => { setSelectedClient(c); setClientResults([]); setClientSearch(c.name); }}>
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedClient && (
              <Badge variant="secondary" className="mt-1 cursor-pointer" onClick={() => { setSelectedClient(null); setClientSearch(""); }}>
                {selectedClient.name} <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1">
            {cart.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 py-2 border-b">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{format(item.unit_price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(idx, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(idx, 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <p className="text-sm font-medium w-20 text-right">{format(item.quantity * item.unit_price)}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(idx)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
              </div>
            ))}
            {cart.length === 0 && <p className="text-center text-muted-foreground py-8">Panier vide</p>}
          </ScrollArea>

          <Separator className="my-4" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Sous-total</span><span>{format(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Remise</span><span>-{format(discountAmount)}</span></div>}
            {taxAmount > 0 && <div className="flex justify-between"><span>TVA ({taxRate}%)</span><span>{format(taxAmount)}</span></div>}
            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{format(total)}</span></div>
          </div>
          <Button className="w-full mt-4" size="lg" disabled={cart.length === 0} onClick={() => setShowPayment(true)}>
            <CreditCard className="h-4 w-4 mr-2" /> Payer {format(total)}
          </Button>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finaliser la vente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Remise</Label>
              <div className="flex gap-2">
                <Select value={discountType} onValueChange={(v: any) => { setDiscountType(v); setDiscountValue(0); }}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">Montant</SelectItem>
                  </SelectContent>
                </Select>
                {discountType !== "none" && (
                  <Input type="number" className="w-24" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
                )}
              </div>
            </div>
            <div>
              <Label>TVA (%)</Label>
              <Input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
            </div>
            {autoPartsStaffSession ? (
              <div>
                <Label>Caissier(ère)</Label>
                <p className="text-sm font-medium text-muted-foreground">{autoPartsStaffSession.name}</p>
              </div>
            ) : staff.length > 0 && (
              <div>
                <Label>Caissier(ère)</Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {staff.filter(s => s.role === "cashier" || s.role === "admin" || s.role === "manager").map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Moyen de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="card">Carte</SelectItem>
                  <SelectItem value="transfer">Virement</SelectItem>
                  <SelectItem value="moncash">MonCash</SelectItem>
                  <SelectItem value="natcash">NatCash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total à payer</span>
                <span>{format(total)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Annuler</Button>
            <Button onClick={handlePayment}>Confirmer le paiement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={(open) => { if (!open) setReceiptSnapshot(null); setShowReceipt(open); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Vente enregistrée</DialogTitle></DialogHeader>
          {lastSale && receiptSnapshot && (
            <>
              <div ref={receiptRef} className="w-[300px] mx-auto p-3 text-[11px] font-mono leading-tight bg-white">
                <div className="text-center mb-3 pb-3" style={{ borderBottom: "1px dashed #ccc" }}>
                  <h3 className="font-bold text-sm uppercase">Pièces Auto</h3>
                  <p className="text-[10px] text-gray-600">Facture #{lastSale.invoice_number}</p>
                  <p className="text-[9px] text-gray-500">{new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                  {receiptSnapshot.staffName && <p className="text-[10px] text-gray-600 mt-1">Caissier: {receiptSnapshot.staffName}</p>}
                  {receiptSnapshot.selectedClient && <p className="text-[10px] text-gray-600 mt-1">Client: {receiptSnapshot.selectedClient.name}</p>}
                </div>
                <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase mb-1 pb-1" style={{ borderBottom: "1px solid #ccc" }}>
                  <span className="flex-[2]">Article</span>
                  <span className="w-12 text-right">Qté</span>
                  <span className="w-16 text-right">Prix</span>
                  <span className="w-16 text-right">Total</span>
                </div>
                <div className="space-y-1 mb-2">
                  {receiptSnapshot.cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px]">
                      <span className="flex-[2] truncate pr-1">{item.product_name}</span>
                      <span className="w-12 text-right text-gray-500">×{item.quantity}</span>
                      <span className="w-16 text-right text-gray-500">{format(item.unit_price)}</span>
                      <span className="w-16 text-right font-medium">{format(item.quantity * item.unit_price)}</span>
                    </div>
                  ))}
                </div>
                <div className="my-2" style={{ borderTop: "1px dashed #ccc" }} />
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Sous-total</span>
                    <span>{format(receiptSnapshot.subtotal)}</span>
                  </div>
                  {receiptSnapshot.discountAmount > 0 && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Remise</span>
                      <span className="text-red-500">-{format(receiptSnapshot.discountAmount)}</span>
                    </div>
                  )}
                  {receiptSnapshot.taxAmount > 0 && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">TVA ({receiptSnapshot.taxRate}%)</span>
                      <span>{format(receiptSnapshot.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[12px] pt-1" style={{ borderTop: "1px solid #ccc" }}>
                    <span>TOTAL</span>
                    <span>{format(receiptSnapshot.total)}</span>
                  </div>
                  <p className="text-center text-[10px] text-gray-500 uppercase pt-1">
                    Paiement: {receiptSnapshot.paymentMethod === "cash" ? "Espèces" :
                               receiptSnapshot.paymentMethod === "card" ? "Carte" :
                               receiptSnapshot.paymentMethod === "transfer" ? "Virement" :
                               receiptSnapshot.paymentMethod === "moncash" ? "MonCash" :
                               receiptSnapshot.paymentMethod === "natcash" ? "NatCash" : receiptSnapshot.paymentMethod}
                  </p>
                </div>
                <div className="text-center mt-3 pt-2" style={{ borderTop: "1px dashed #ccc" }}>
                  <p className="text-[9px] text-gray-400">Merci de votre visite !</p>
                  <p className="text-[8px] text-gray-400 mt-1">Document généré électroniquement</p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setShowReceipt(false); setReceiptSnapshot(null); }}>Fermer</Button>
                <Button onClick={() => receiptRef.current && printReceipt(receiptRef.current, `facture-${lastSale.invoice_number}`)}>
                  <Printer className="h-4 w-4 mr-2" /> Imprimer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
