import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStationeryBusinessId } from "@/modules/stationery/hooks/useStationeryBusinessId";
import { listProducts } from "@/modules/stationery/services/products";
import { listCategories } from "@/modules/stationery/services/categories";
import { searchClients } from "@/modules/stationery/services/clients";
import { createSale } from "@/modules/stationery/services/sales";
import { listStaff } from "@/modules/stationery/services/staff";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { ReceiptTemplate, ReceiptData } from "@/components/printing/ReceiptTemplate";
import { printUnifiedReceipt } from "@/components/printing/receipt-engine";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Trash2, Search, User, CreditCard, X, Printer, PackageOpen } from "lucide-react";
import type { StationeryProduct, StationeryCategory } from "@/modules/stationery/types";

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export default function StationeryPOSPage() {
  const { t } = useTranslation();
  const businessId = useStationeryBusinessId();
  const { format, currencyCode } = useCurrency();
  const { profile } = useAuth();
  
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
  const [lastSale, setLastSale] = useState<{ id: string; invoice_number: string } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [amountTendered, setAmountTendered] = useState<number | "">("");
  const receiptRef = useRef<HTMLDivElement>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [receiptSnapshot, setReceiptSnapshot] = useState<any>(null);

  const { data: posData, isLoading: loading, refetch } = useQuery({
    queryKey: ["stationery-pos-data", businessId],
    queryFn: async () => {
      const [productsData, categoriesData, staffList] = await Promise.all([
        listProducts(businessId!),
        listCategories(businessId!),
        listStaff(businessId!),
      ]);
      return { productsData, categoriesData, staffList };
    },
    enabled: !!businessId,
    staleTime: 2 * 60 * 1000,
  });

  const products = posData?.productsData || [];
  const categories = posData?.categoriesData || [];
  const staff = posData?.staffList || [];

  useEffect(() => {
    if (staff.length > 0 && profile && profile.business_id === businessId) {
      setSelectedStaff(profile.id);
    }
  }, [staff, profile, businessId]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (!p.active) return false;
      if (catFilter !== "all" && p.category_id !== catFilter) return false;
      if (searchQ && 
          !p.name.toLowerCase().includes(searchQ.toLowerCase()) && 
          !p.sku?.toLowerCase().includes(searchQ.toLowerCase()) &&
          !p.barcode?.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    });
  }, [products, catFilter, searchQ]);

  const addToCart = (p: StationeryProduct) => {
    if (Number(p.stock_quantity) <= 0) {
      toast.error(`${p.name} — Stock épuisé`);
      return;
    }
    if (p.selling_price == null) {
      toast.error(`${p.name} — Prix de vente non renseigné`);
      return;
    }
    
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        if (existing.quantity >= p.stock_quantity) {
          toast.error("Stock insuffisant pour augmenter la quantité.");
          return prev;
        }
        return prev.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: Number(p.selling_price) }];
    });
  };

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const item = prev[idx];
      const product = products.find(p => p.id === item.product_id);
      
      let newQty = Math.max(1, item.quantity + delta);
      
      if (product && newQty > product.stock_quantity) {
        toast.error("Stock insuffisant !");
        newQty = product.stock_quantity;
      }
      
      return prev.map((i, ix) => ix === idx ? { ...i, quantity: newQty } : i);
    });
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

  const handleSearchClient = async (q: string) => {
    setClientSearch(q);
    if (q.length < 1) { setClientResults([]); return; }
    try { setClientResults(await searchClients(q, businessId!)); } catch { }
  };

  const handlePayment = async () => {
    if (!businessId || cart.length === 0) return;
    const staffMember = staff.find(s => s.id === selectedStaff) || { name: profile?.name || "Caisse" };
    const tendered = typeof amountTendered === "number" ? amountTendered : total;
    const amountPaid = Math.min(Math.max(tendered, 0), total);
    const balanceDue = Math.max(total - amountPaid, 0);
    
    if (balanceDue > 0 && !selectedClient) {
      toast.error("Sélectionnez un client pour enregistrer un paiement partiel.");
      return;
    }
    
    try {
      const invNumber = "INV-" + Math.floor(Date.now() / 1000).toString();
      
      const sale = await createSale(businessId, "", { // branchId would normally come from hook
        customer_id: selectedClient?.id,
        cashier_id: selectedStaff || undefined,
        invoice_number: invNumber,
        total_amount: total,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        balance: balanceDue,
      }, cart.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.quantity * i.unit_price
      })));
      
      const change = Math.max(tendered - total, 0);
      setReceiptSnapshot({
        cart: [...cart],
        subtotal,
        discountAmount,
        taxRate,
        taxAmount,
        total,
        paymentMethod,
        selectedClient: selectedClient ? { ...selectedClient } : null,
        staffName: staffMember?.name || "Caisse",
        companyName: "Papeterie", // Usually from settings
        amountTendered: tendered,
        changeGiven: change,
      });
      
      setLastSale({ id: sale.id, invoice_number: sale.invoice_number });
      setCart([]);
      setSelectedClient(null);
      setDiscountType("none");
      setDiscountValue(0);
      setTaxRate(0);
      setAmountTendered("");
      setShowPayment(false);
      setShowReceipt(true);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout role="salon_admin" title="Point de Vente" subtitle="Caisse Papeterie">
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
        {/* Left: Products */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, Code-barres ou SKU..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-10" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || "#ccc" }} />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtered.map((p) => (
                <Card key={p.id} className="cursor-pointer hover:border-primary transition-colors hover:shadow-md" onClick={() => addToCart(p)}>
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: p.category?.color || "#ccc" }} title={p.category?.name} />
                      <Badge variant={Number(p.stock_quantity) <= 0 ? "destructive" : Number(p.stock_quantity) <= Number(p.min_stock_alert) ? "secondary" : "outline"} className="text-[10px]">
                        {p.stock_quantity} {p.selling_unit}s
                      </Badge>
                    </div>
                    <p className="font-semibold text-sm line-clamp-2 flex-1 notranslate" translate="no">{p.name}</p>
                    <div className="mt-2 flex items-end justify-between">
                      <p className="text-xs text-muted-foreground truncate max-w-[50%]">{p.barcode || p.sku || ""}</p>
                      <p className="text-lg font-bold text-primary">{p.selling_price == null ? "-" : format(Number(p.selling_price))}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center text-muted-foreground py-20 opacity-60">
                  <PackageOpen className="h-16 w-16 mb-4" />
                  <p className="text-lg font-medium">Aucun produit trouvé</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Cart */}
        <div className="w-full lg:w-[400px] flex flex-col border rounded-lg bg-card overflow-hidden">
          <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">Panier</h2>
            </div>
            <Badge variant="secondary" className="px-2 py-1 font-mono text-sm">{cart.reduce((s, i) => s + i.quantity, 0)} articles</Badge>
          </div>

          <div className="p-4 border-b bg-muted/10">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Sélectionner ou rechercher un client..." value={clientSearch} onChange={(e) => handleSearchClient(e.target.value)} className="pl-10 h-10" />
              {clientResults.length > 0 && (
                <div className="absolute z-10 w-full border rounded-md mt-1 bg-background shadow-lg max-h-48 overflow-y-auto">
                  {clientResults.map((c) => (
                    <div key={c.id} className="px-4 py-3 cursor-pointer hover:bg-muted text-sm border-b last:border-0 font-medium" onClick={() => { setSelectedClient(c); setClientResults([]); setClientSearch(c.name); }}>
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedClient && (
              <div className="mt-2 flex items-center justify-between bg-primary/10 text-primary px-3 py-2 rounded-md">
                <span className="font-semibold text-sm">{selectedClient.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/20" onClick={() => { setSelectedClient(null); setClientSearch(""); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 p-2">
            {cart.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 border-b last:border-0 hover:bg-muted/50 rounded-md transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate notranslate" translate="no" title={item.product_name}>{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{format(item.unit_price)} l'unité</p>
                </div>
                <div className="flex items-center gap-1 bg-muted/50 rounded-md border p-0.5">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-background" onClick={() => updateQty(idx, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-background" onClick={() => updateQty(idx, 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <p className="text-sm font-bold w-20 text-right">{format(item.quantity * item.unit_price)}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50 hover:opacity-100" onClick={() => removeFromCart(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center text-muted-foreground h-40 opacity-50">
                <ShoppingCart className="h-10 w-10 mb-2" />
                <p className="text-sm font-medium">Panier vide</p>
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t bg-muted/20">
            <div className="space-y-1.5 text-sm notranslate" translate="no">
              <div className="flex justify-between text-muted-foreground"><span>Sous-total</span><span className="font-medium text-foreground">{format(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Remise</span><span className="font-medium">-{format(discountAmount)}</span></div>}
              {taxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>TCA ({taxRate}%)</span><span className="font-medium text-foreground">{format(taxAmount)}</span></div>}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-2xl mt-2">
                <span>Total</span>
                <span className="text-primary">{format(total)}</span>
              </div>
            </div>
            <Button className="w-full mt-4 h-14 text-lg font-bold shadow-lg" disabled={cart.length === 0} onClick={() => setShowPayment(true)}>
              Payer {format(total)}
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md sm:rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Encaissement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Remise appliquée</Label>
              <div className="flex gap-2 mt-1">
                <Select value={discountType} onValueChange={(v: any) => { setDiscountType(v); setDiscountValue(0); }}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                    <SelectItem value="fixed">Montant fixe</SelectItem>
                  </SelectContent>
                </Select>
                {discountType !== "none" && (
                  <Input type="number" className="flex-1" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">TCA (%)</Label>
                <Input type="number" className="mt-1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Moyen de paiement</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="card">Carte Bancaire</SelectItem>
                    <SelectItem value="transfer">Virement</SelectItem>
                    <SelectItem value="moncash">MonCash</SelectItem>
                    <SelectItem value="natcash">NatCash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="border-t pt-4 mt-2">
              <div className="flex justify-between items-center text-xl font-bold mb-4">
                <span>Total à payer</span>
                <span className="text-3xl text-primary">{format(total)}</span>
              </div>
              
              {paymentMethod === "cash" && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant reçu</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder={`Montant remis par le client...`}
                    className="h-12 text-lg font-bold"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  {typeof amountTendered === "number" && amountTendered >= total && (
                    <div className="flex items-center justify-between bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-3 mt-2">
                      <span className="font-bold">Monnaie à rendre</span>
                      <span className="text-xl font-black">{format(amountTendered - total)}</span>
                    </div>
                  )}
                  {typeof amountTendered === "number" && amountTendered > 0 && amountTendered < total && (
                    <div className="flex items-center justify-between bg-orange-50 text-orange-600 border border-orange-200 rounded-lg px-4 py-3 mt-2">
                      <span className="font-bold">Paiement partiel (Crédit)</span>
                      <span className="font-bold">Reste: {format(total - amountTendered)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" className="h-12 flex-1" onClick={() => setShowPayment(false)}>{t("common.cancel")}</Button>
            <Button onClick={handlePayment} className="h-12 flex-[2] text-base font-bold">Valider la vente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={(open) => { 
        if (!open) { setReceiptSnapshot(null); setShowReceipt(false); refetch(); } else { setShowReceipt(open); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vente enregistrée avec succès</DialogTitle></DialogHeader>
          {lastSale && receiptSnapshot && (
            <>
              <div className="max-h-[60vh] overflow-y-auto bg-gray-100 p-2 rounded flex justify-center">
                <ReceiptTemplate 
                  ref={receiptRef}
                  formatAmount={format}
                  data={{
                    business: {
                      name: receiptSnapshot.companyName || "PAPETERIE",
                    },
                    transaction: {
                      invoiceNumber: lastSale.invoice_number,
                      date: new Date().toISOString(),
                      cashierName: receiptSnapshot.staffName,
                      clientName: receiptSnapshot.selectedClient?.name,
                      cashRegister: "CAISSE PAPETERIE"
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
                      method: receiptSnapshot.paymentMethod.toUpperCase(),
                      amountReceived: (receiptSnapshot as any).amountTendered ?? receiptSnapshot.total,
                      amountTendered: (receiptSnapshot as any).amountTendered,
                      changeGiven: (receiptSnapshot as any).changeGiven
                    },
                    currencyCode: currencyCode
                  }}
                />
              </div>
              <DialogFooter className="gap-2 mt-4">
                <Button variant="outline" onClick={() => { setShowReceipt(false); setReceiptSnapshot(null); refetch(); }}>Fermer</Button>
                <Button onClick={() => {
                  if (receiptRef.current) {
                    const data: ReceiptData = {
                      business: { name: receiptSnapshot.companyName || "PAPETERIE" },
                      transaction: { invoiceNumber: lastSale.invoice_number, date: new Date().toISOString(), cashierName: receiptSnapshot.staffName, clientName: receiptSnapshot.selectedClient?.name, cashRegister: "CAISSE PAPETERIE" },
                      items: receiptSnapshot.cart.map((item: any) => ({ name: item.product_name, quantity: item.quantity, price: item.unit_price, total: item.quantity * item.unit_price })),
                      totals: { subtotal: receiptSnapshot.subtotal, discount: receiptSnapshot.discountAmount, tax: receiptSnapshot.taxAmount, total: receiptSnapshot.total },
                      payment: { method: receiptSnapshot.paymentMethod.toUpperCase(), amountReceived: (receiptSnapshot as any).amountTendered ?? receiptSnapshot.total, amountTendered: (receiptSnapshot as any).amountTendered, changeGiven: (receiptSnapshot as any).changeGiven },
                      currencyCode: currencyCode
                    };
                    printUnifiedReceipt(data, format);
                  }
                }}>
                  <Printer className="h-4 w-4 mr-2" /> Imprimer le reçu
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
