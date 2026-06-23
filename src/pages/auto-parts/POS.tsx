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
import { supabase } from "@/lib/supabase";
import { ReceiptTemplate, ReceiptData } from "@/components/printing/ReceiptTemplate";
import { printUnifiedReceipt } from "@/components/printing/receipt-engine";
import { useAuth } from "@/hooks/useAuth";
import { printReceipt } from "@/lib/print-utils";
import { getBusinessSettings } from "@/modules/auto-parts/services/businessSettings";
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
  const { format, currencyCode } = useCurrency();
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
  const [amountTendered, setAmountTendered] = useState<number | "">("");
  const receiptRef = useRef<HTMLDivElement>(null);
  const [staff, setStaff] = useState<AutoPartsStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [receiptSnapshot, setReceiptSnapshot] = useState<{
    cart: CartItem[]; subtotal: number; discountAmount: number;
    taxRate: number; taxAmount: number; total: number;
    paymentMethod: string; selectedClient: { id: string; name: string } | null;
    staffName: string;
    companyName: string; logoUrl?: string; address?: string; phone?: string; nif?: string;
    receiptHeader?: string; receiptFooter?: string;
  } | null>(null);
  const [bizSettings, setBizSettings] = useState<{
    company_name: string; logo_url?: string; address?: string; phone?: string; nif?: string;
    receipt_header?: string; receipt_footer?: string; invoice_prefix?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [productsData, categoriesData, staffList, bizSettings] = await Promise.all([
          listProducts(businessId) as any,
          listCategories(businessId),
          listStaff(businessId),
          getBusinessSettings(businessId).catch(() => null),
        ]);
        setProducts(productsData);
        setCategories(categoriesData);
        setStaff(staffList);
        setBizSettings(bizSettings);
        if (autoPartsStaffSession && autoPartsStaffSession.business_id === businessId) {
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
    if (Number(p.stock_quantity) <= 0) {
      toast.error(`${p.name} — Stock épuisé`);
      return;
    }
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
    try { setClientResults(await searchClients(q, businessId)); } catch { }
  };

  const handlePayment = async () => {
    if (!businessId || cart.length === 0) return;
    const validStaffSession = autoPartsStaffSession && autoPartsStaffSession.business_id === businessId ? autoPartsStaffSession : undefined;
    const staffMember = staff.find(s => s.id === selectedStaff) || (validStaffSession ? { name: validStaffSession.name } as AutoPartsStaff : undefined);
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
      const tendered = typeof amountTendered === "number" && amountTendered >= total ? amountTendered : total;
      const change = tendered - total;
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
        companyName: bizSettings?.company_name || "Pièces Auto",
        logoUrl: bizSettings?.logo_url,
        address: bizSettings?.address,
        phone: bizSettings?.phone,
        nif: bizSettings?.nif,
        receiptHeader: bizSettings?.receipt_header,
        receiptFooter: bizSettings?.receipt_footer,
        amountTendered: tendered,
        changeGiven: change,
      } as any);
      setLastSale({ id: sale.id, invoice_number: sale.invoice_number });
      setCart([]);
      setSelectedClient(null);
      setSelectedStaff("");
      setDiscountType("none");
      setDiscountValue(0);
      setTaxRate(0);
      setAmountTendered("");
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
        <DialogContent className="sm:max-w-md sm:rounded-[24px] border border-cyan-500/20 dark:border-cyan-400/20 shadow-[0_0_50px_rgba(34,211,238,0.15)] bg-white/95 dark:bg-[#0A0A0F]/95 backdrop-blur-2xl dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-cyan-400 bg-clip-text text-transparent">
              Finaliser la vente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Remise</Label>
              <div className="flex gap-3 mt-1.5">
                <Select value={discountType} onValueChange={(v: any) => { setDiscountType(v); setDiscountValue(0); }}>
                  <SelectTrigger className="w-32 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#12121a] dark:border-white/10 dark:text-white">
                    <SelectItem value="none">Aucune</SelectItem>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">Montant</SelectItem>
                  </SelectContent>
                </Select>
                {discountType !== "none" && (
                  <Input type="number" className="flex-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-12 dark:text-white" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">TVA (%)</Label>
              <Input type="number" className="mt-1.5 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-12 dark:text-white" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
            </div>
            {autoPartsStaffSession && autoPartsStaffSession.business_id === businessId ? (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Caissier(ère)</Label>
                <div className="mt-1.5 flex items-center h-12 px-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <p className="text-sm font-medium dark:text-white">{autoPartsStaffSession.name}</p>
                </div>
              </div>
            ) : staff.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Caissier(ère)</Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger className="mt-1.5 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-12"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent className="dark:bg-[#12121a] dark:border-white/10 dark:text-white">
                    {staff.filter(s => s.role === "cashier" || s.role === "admin" || s.role === "manager").map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Moyen de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1.5 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-12"><SelectValue /></SelectTrigger>
                <SelectContent className="dark:bg-[#12121a] dark:border-white/10 dark:text-white">
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="card">Carte</SelectItem>
                  <SelectItem value="transfer">Virement</SelectItem>
                  <SelectItem value="moncash">MonCash</SelectItem>
                  <SelectItem value="natcash">NatCash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t border-slate-200 dark:border-white/10 pt-5 mt-2">
              <div className="flex justify-between items-center text-xl font-bold mb-4">
                <span className="dark:text-white">Total à payer</span>
                <span className="bg-gradient-to-r from-violet-500 to-cyan-400 bg-clip-text text-transparent text-3xl font-display">{format(total)}</span>
              </div>
              {/* Montant donné + Monnaie */}
              {paymentMethod === "cash" && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">Montant donné par le client</Label>
                  <Input
                    type="number"
                    min={total}
                    step="any"
                    placeholder={`Min ${format(total)}`}
                    className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl h-12 dark:text-white"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  {typeof amountTendered === "number" && amountTendered >= total && (
                    <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                      <span className="text-sm font-semibold text-green-700 dark:text-green-400">💵 Monnaie à rendre</span>
                      <span className="text-2xl font-bold text-green-700 dark:text-green-400">{format(amountTendered - total)}</span>
                    </div>
                  )}
                  {typeof amountTendered === "number" && amountTendered > 0 && amountTendered < total && (
                    <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                      <span className="text-sm font-semibold text-red-600">⚠️ Montant insuffisant</span>
                      <span className="text-sm font-bold text-red-600">{format(total - amountTendered)} manquant</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-between">
            <Button variant="ghost" className="rounded-xl h-12 flex-1 dark:text-slate-300 dark:hover:bg-white/5" onClick={() => setShowPayment(false)}>Annuler</Button>
            <Button onClick={handlePayment} className="rounded-xl h-12 flex-[2] bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-lg shadow-violet-500/25 border-0 text-base font-semibold transition-all">
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={(open) => { if (!open) setReceiptSnapshot(null); setShowReceipt(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vente enregistrée</DialogTitle></DialogHeader>
          {lastSale && receiptSnapshot && (
            <>
              <div className="max-h-[60vh] overflow-y-auto bg-gray-100 p-2 rounded flex justify-center">
                <ReceiptTemplate 
                  ref={receiptRef}
                  formatAmount={format}
                  data={{
                    business: {
                      name: receiptSnapshot.companyName || "PIÈCES AUTO",
                      logo_url: receiptSnapshot.logoUrl,
                      address: receiptSnapshot.address,
                      phone: receiptSnapshot.phone,
                      nif: receiptSnapshot.nif,
                      receipt_footer_message: receiptSnapshot.receiptFooter,
                    },
                    transaction: {
                      invoiceNumber: lastSale.invoice_number,
                      date: new Date().toISOString(),
                      cashierName: receiptSnapshot.staffName,
                      clientName: receiptSnapshot.selectedClient?.name,
                      cashRegister: "CAISSE PRINCIPALE"
                    },
                    items: receiptSnapshot.cart.map((item: any) => ({
                      name: item.product_name,
                      quantity: item.quantity,
                      price: item.unit_price,
                      total: item.quantity * item.unit_price
                    })),
                    totals: {
                      subtotal: receiptSnapshot.subtotal,
                      discount: receiptSnapshot.discountAmount,
                      tax: receiptSnapshot.taxAmount,
                      total: receiptSnapshot.total
                    },
                    payment: {
                      method: receiptSnapshot.paymentMethod === "cash" ? "ESPÈCES" :
                              receiptSnapshot.paymentMethod === "card" ? "CARTE" :
                              receiptSnapshot.paymentMethod === "moncash" ? "MONCASH" :
                              receiptSnapshot.paymentMethod === "natcash" ? "NATCASH" : "VIREMENT",
                      amountReceived: receiptSnapshot.total,
                      amountTendered: (receiptSnapshot as any).amountTendered,
                      changeGiven: (receiptSnapshot as any).changeGiven
                    },
                    currencyCode: currencyCode
                  }}
                />
              </div>
              <DialogFooter className="gap-2 mt-4">
                <Button variant="outline" onClick={() => { setShowReceipt(false); setReceiptSnapshot(null); }}>Fermer</Button>
                <Button onClick={() => {
                  if (receiptRef.current) {
                    const data: ReceiptData = {
                      business: {
                        name: receiptSnapshot.companyName || "PIÈCES AUTO",
                        logo_url: receiptSnapshot.logoUrl,
                        address: receiptSnapshot.address,
                        phone: receiptSnapshot.phone,
                        nif: receiptSnapshot.nif,
                        receipt_footer_message: receiptSnapshot.receiptFooter,
                      },
                      transaction: {
                        invoiceNumber: lastSale.invoice_number,
                        date: new Date().toISOString(),
                        cashierName: receiptSnapshot.staffName,
                        clientName: receiptSnapshot.selectedClient?.name,
                        cashRegister: "CAISSE PRINCIPALE"
                      },
                      items: receiptSnapshot.cart.map((item: any) => ({
                        name: item.product_name,
                        quantity: item.quantity,
                        price: item.unit_price,
                        total: item.quantity * item.unit_price
                      })),
                      totals: {
                        subtotal: receiptSnapshot.subtotal,
                        discount: receiptSnapshot.discountAmount,
                        tax: receiptSnapshot.taxAmount,
                        total: receiptSnapshot.total
                      },
                      payment: {
                        method: receiptSnapshot.paymentMethod === "cash" ? "ESPÈCES" :
                                receiptSnapshot.paymentMethod === "card" ? "CARTE" :
                                receiptSnapshot.paymentMethod === "moncash" ? "MONCASH" :
                                receiptSnapshot.paymentMethod === "natcash" ? "NATCASH" : "VIREMENT",
                      amountReceived: receiptSnapshot.total,
                        amountTendered: (receiptSnapshot as any).amountTendered,
                        changeGiven: (receiptSnapshot as any).changeGiven
                      },
                      currencyCode: currencyCode
                    };
                    printUnifiedReceipt(data, format);
                  }
                }}>
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
