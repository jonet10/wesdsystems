import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, ShoppingCart, Trash2, Plus, Minus, User, FileText, Printer } from "lucide-react";
import type { PharmacyProduct, PharmacyCustomer, PharmacyPrescription } from "@/modules/pharmacy/types";
import { productService } from "@/modules/pharmacy/services/productService";
import { salesService } from "@/modules/pharmacy/services/salesService";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { ReceiptTemplate, ReceiptData } from "@/components/printing/ReceiptTemplate";
import { printReceipt } from "@/lib/print-utils";

export default function PharmacyPOS() {
  const { format } = useCurrency();
  const { profile } = useAuth();
  
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [customers, setCustomers] = useState<PharmacyCustomer[]>([]);
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedPrescription, setSelectedPrescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [receiptSnapshot, setReceiptSnapshot] = useState<ReceiptData | null>(null);
  
  const receiptRef = useRef<HTMLDivElement>(null);

  const businessId = usePharmacyBusinessId();

  useEffect(() => {
    if (businessId) {
      loadData(businessId);
    }
  }, [businessId]);

  const loadData = async (bizId: string) => {
    try {
      const [prods, custs, prescs, biz] = await Promise.all([
        productService.getProducts(bizId),
        salesService.getCustomers(bizId),
        salesService.getPrescriptions(bizId),
        supabase
          .from("businesses")
          .select("name, phone, email, address, logo_url, nif")
          .eq("id", bizId)
          .maybeSingle()
      ]);
      setProducts(prods.filter(p => p.total_stock_quantity > 0)); // Only show in-stock items in POS
      setCustomers(custs);
      setPrescriptions(prescs);
      setBusinessInfo(biz?.data || null);
    } catch (e: any) {
      toast.error("Erreur de chargement des données POS : " + e.message);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.barcode?.includes(searchQuery)
  );

  const addToCart = (product: PharmacyProduct) => {
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.total_stock_quantity) {
        toast.error("Stock insuffisant !");
        return;
      }
      setCart(cart.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { 
        product_id: product.id, 
        name: product.name, 
        quantity: 1, 
        unit_price: product.sale_price || 150, 
        requires_prescription: product.requires_prescription,
        max_stock: product.total_stock_quantity
      }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQ = item.quantity + delta;
        if (newQ > item.max_stock) {
          toast.error("Stock insuffisant !");
          return item;
        }
        if (newQ <= 0) return item;
        return { ...item, quantity: newQ };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const totalAmount = cart.reduce((acc, curr) => acc + (curr.quantity * curr.unit_price), 0);
  const requiresPrescription = cart.some(item => item.requires_prescription);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (requiresPrescription && !selectedPrescription) {
      toast.error("Cette vente contient des médicaments sur ordonnance. Veuillez lier une ordonnance valide.");
      return;
    }

    setIsProcessing(true);
    try {
      const salePayload = {
        customer_id: selectedCustomer && selectedCustomer !== "none" ? selectedCustomer : null,
        prescription_id: selectedPrescription || null,
        subtotal: totalAmount,
        tax_amount: 0,
        discount_amount: 0,
        total: totalAmount,
        payment_method: paymentMethod as any,
        payment_status: "paid" as const,
        receipt_number: `REC-${Date.now().toString().slice(-6)}`
      };

      const newSale = await salesService.processSale(salePayload, cart, businessId || undefined);
      
      // Build the receipt snapshot
      const selectedCustObj = customers.find(c => c.id === selectedCustomer);
      const snapshot: ReceiptData = {
        business: {
          name: businessInfo?.name || "PHARMACIE",
          logo_url: businessInfo?.logo_url || undefined,
          address: businessInfo?.address || undefined,
          phone: businessInfo?.phone || undefined,
          email: businessInfo?.email || undefined,
          nif: businessInfo?.nif || undefined,
          receipt_footer_message: "Merci pour votre confiance !",
          receipt_policy_message: "Aucun retour de médicament n'est autorisé pour des raisons de sécurité de santé publique."
        },
        transaction: {
          invoiceNumber: newSale.receipt_number,
          invoiceLabel: "Reçu de Vente",
          date: newSale.created_at,
          cashierName: profile?.full_name || "Caissier",
          clientName: selectedCustObj ? `${selectedCustObj.first_name} ${selectedCustObj.last_name}` : "Client de passage",
          clientPhone: selectedCustObj?.phone || undefined
        },
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.unit_price,
          total: item.quantity * item.unit_price
        })),
        totals: {
          subtotal: totalAmount,
          tax: 0,
          discount: 0,
          total: totalAmount
        },
        payment: {
          method: paymentMethod === "cash" ? "ESPÈCES" :
                  paymentMethod === "card" ? "CARTE" :
                  paymentMethod === "moncash" ? "MONCASH" :
                  paymentMethod === "natcash" ? "NATCASH" :
                  paymentMethod === "transfer" ? "VIREMENT" : "CRÉDIT",
          amountReceived: totalAmount,
          amountTendered: totalAmount,
          changeGiven: 0
        },
        currencyCode: "HTG"
      };

      setLastSale(newSale);
      setReceiptSnapshot(snapshot);
      setShowReceipt(true);

      toast.success("Vente effectuée avec succès !");
      setCart([]);
      setSelectedCustomer("");
      setSelectedPrescription("");
      if (businessId) loadData(businessId); // Reload stock
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = async () => {
    if (receiptRef.current) {
      await printReceipt(receiptRef.current, `ticket-${lastSale?.receipt_number || "sale"}`);
    }
  };

  return (
    <DashboardLayout role="salon_admin" title="Point de Vente (Caisse)" subtitle="Vente au comptoir">
      <div className="grid lg:grid-cols-3 gap-6 p-6 h-[calc(100vh-140px)]">
        
        {/* LEFT PANEL : PRODUCTS CATALOG */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un médicament (Nom, DCI, Code barre)..." 
              className="pl-10 text-lg py-6 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4 pb-4">
            {filteredProducts.map(p => (
              <Card key={p.id} className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => addToCart(p)}>
                <CardContent className="p-4 flex flex-col h-full justify-between">
                  <div>
                    <h3 className="font-bold leading-tight">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{p.form}</p>
                  </div>
                  <div className="mt-4 flex justify-between items-end">
                    <span className="text-sm font-semibold bg-gray-100 px-2 py-1 rounded">Stock: {p.total_stock_quantity}</span>
                    {p.requires_prescription && <FileText className="w-4 h-4 text-red-500" title="Ordonnance requise" />}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-10">Aucun produit trouvé ou en stock.</div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL : CART & CHECKOUT */}
        <div className="bg-white dark:bg-gray-900 border rounded-xl flex flex-col shadow-sm">
          <div className="p-4 border-b bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-lg">Panier Actuel</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">Panier vide</div>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className="flex justify-between items-center border-b pb-2">
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-1">
                      {item.name}
                      {item.requires_prescription && <FileText className="w-3 h-3 text-red-500" />}
                    </div>
                    <div className="text-sm text-muted-foreground">{format(item.unit_price)} x {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md">
                      <button onClick={() => updateQuantity(item.product_id, -1)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-l-md"><Minus className="w-4 h-4"/></button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product_id, 1)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-r-md"><Plus className="w-4 h-4"/></button>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8" onClick={() => removeFromCart(item.product_id)}><Trash2 className="w-4 h-4"/></Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t bg-gray-50/50 dark:bg-gray-800/50 space-y-4">
            
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs"><User className="w-3 h-3"/> Patient (Optionnel)</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Client de passage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Client de passage</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {requiresPrescription && (
              <div className="space-y-2 border border-red-200 bg-red-50 dark:bg-red-950/20 p-2 rounded-md">
                <Label className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-bold"><FileText className="w-3 h-3"/> Ordonnance Requise *</Label>
                <Select value={selectedPrescription} onValueChange={setSelectedPrescription}>
                  <SelectTrigger className="h-8 text-sm border-red-300"><SelectValue placeholder="Lier une ordonnance..." /></SelectTrigger>
                  <SelectContent>
                    {prescriptions.map(p => <SelectItem key={p.id} value={p.id}>Ord. du {new Date(p.prescription_date).toLocaleDateString()} - Dr. {p.doctor_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Moyen de Paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="card">Carte Bancaire</SelectItem>
                  <SelectItem value="moncash">MonCash</SelectItem>
                  <SelectItem value="insurance">Assurance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <span className="text-lg font-bold">Total à Payer</span>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{format(totalAmount)}</span>
            </div>

            <Button 
              className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700" 
              onClick={handleCheckout} 
              disabled={cart.length === 0 || isProcessing}
            >
              {isProcessing ? "Encaissement..." : "Encaisser & Facturer"}
            </Button>
          </div>
        </div>

      </div>

      {/* Receipt Preview & Print Dialog */}
      <Dialog open={showReceipt} onOpenChange={(open) => {
        if (!open) {
          setReceiptSnapshot(null);
          setLastSale(null);
        }
        setShowReceipt(open);
      }}>
        <DialogContent className="max-w-md bg-white text-black p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-center font-bold text-gray-800">Fiche de Vente (Ticket)</DialogTitle>
          </DialogHeader>
          
          <div className="p-6 max-h-[60vh] overflow-y-auto bg-gray-100 flex justify-center">
            {receiptSnapshot && (
              <div className="bg-white p-4 shadow-md rounded-md border w-full max-w-[80mm]">
                <ReceiptTemplate 
                  ref={receiptRef} 
                  data={receiptSnapshot} 
                  formatAmount={(amt) => format(amt)}
                />
              </div>
            )}
          </div>
          
          <DialogFooter className="p-4 border-t bg-gray-50 flex gap-2 justify-end">
            <Button variant="outline" className="text-gray-700" onClick={() => { setShowReceipt(false); setReceiptSnapshot(null); setLastSale(null); }}>
              Fermer
            </Button>
            <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Printer className="w-4 h-4" />
              Imprimer / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
