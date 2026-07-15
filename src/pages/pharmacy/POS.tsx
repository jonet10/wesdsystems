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
import { Search, ShoppingCart, Trash2, Plus, Minus, User, FileText, Printer, Pill, Droplet, Layers, Sparkles, Activity } from "lucide-react";
import type { PharmacyProduct, PharmacyCustomer, PharmacyPrescription } from "@/modules/pharmacy/types";
import { productService } from "@/modules/pharmacy/services/productService";
import { salesService } from "@/modules/pharmacy/services/salesService";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { ReceiptTemplate, ReceiptData } from "@/components/printing/ReceiptTemplate";
import { printReceipt } from "@/lib/print-utils";
import { getBusinessSettings } from "@/modules/auto-parts/services/businessSettings";

const getProductVisual = (name: string, form: string, imageUrl?: string | null) => {
  if (imageUrl) {
    return {
      element: (
        <img 
          src={imageUrl} 
          alt={name} 
          className="w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.05]" 
        />
      ),
      bg: "bg-white",
      border: "border-border",
      tag: form || "Produit"
    };
  }

  const n = name.toLowerCase();
  const f = form?.toLowerCase() || "";
  
  if (f.includes("sirop") || f.includes("solution") || f.includes("suspension") || f.includes("gouttes") || n.includes("sirop") || n.includes("solution") || n.includes("alcool")) {
    return {
      element: <Droplet className="w-8 h-8 text-sky-500 transition-transform duration-300 group-hover:scale-110" />,
      bg: "from-sky-500/10 to-sky-500/5",
      border: "border-sky-500/20",
      tag: "Liquide / Sirop"
    };
  }
  if (f.includes("sachet") || f.includes("poudre") || n.includes("sachet") || n.includes("poudre")) {
    return {
      element: <Layers className="w-8 h-8 text-amber-500 transition-transform duration-300 group-hover:scale-110" />,
      bg: "from-amber-500/10 to-amber-500/5",
      border: "border-amber-500/20",
      tag: "Sachet / Poudre"
    };
  }
  if (f.includes("crème") || f.includes("gel") || f.includes("pommade") || n.includes("crème") || n.includes("gel") || n.includes("pommade")) {
    return {
      element: <Sparkles className="w-8 h-8 text-teal-500 transition-transform duration-300 group-hover:scale-110" />,
      bg: "from-teal-500/10 to-teal-500/5",
      border: "border-teal-500/20",
      tag: "Crème / Gel"
    };
  }
  if (f.includes("gélule") || f.includes("capsule") || n.includes("gélule") || n.includes("capsule")) {
    return {
      element: <Pill className="w-8 h-8 text-orange-500 rotate-45 transition-transform duration-300 group-hover:scale-110" />,
      bg: "from-orange-500/10 to-orange-500/5",
      border: "border-orange-500/20",
      tag: "Gélule / Capsule"
    };
  }
  if (f.includes("injection") || f.includes("ampoule") || f.includes("vaccin") || n.includes("injection") || n.includes("ampoule") || n.includes("vaccin")) {
    return {
      element: <Activity className="w-8 h-8 text-rose-500 transition-transform duration-300 group-hover:scale-110" />,
      bg: "from-rose-500/10 to-rose-500/5",
      border: "border-rose-500/20",
      tag: "Injection / Ampoule"
    };
  }
  if (f.includes("comprimé") || f.includes("comprimes") || f.includes("tablet") || n.includes("comprimé") || n.includes("tablet")) {
    return {
      element: <Pill className="w-8 h-8 text-indigo-500 transition-transform duration-300 group-hover:scale-110" />,
      bg: "from-indigo-500/10 to-indigo-500/5",
      border: "border-indigo-500/20",
      tag: "Comprimé"
    };
  }
  // Default
  return {
    element: <Pill className="w-8 h-8 text-purple-500 transition-transform duration-300 group-hover:scale-110" />,
    bg: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/20",
    tag: form || "Médicament"
  };
};

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
      const [prods, custs, prescs, biz, bizSettings] = await Promise.all([
        productService.getProducts(bizId),
        salesService.getCustomers(bizId),
        salesService.getPrescriptions(bizId),
        supabase
          .from("businesses")
          .select("name, logo_url")
          .eq("id", bizId)
          .maybeSingle(),
        getBusinessSettings(bizId).catch(() => null)
      ]);
      setProducts(prods.filter(p => p.total_stock_quantity > 0)); // Only show in-stock items in POS
      setCustomers(custs);
      setPrescriptions(prescs);
      setBusinessInfo({
        name: biz?.data?.name || bizSettings?.company_name || "PHARMACIE",
        logo_url: biz?.data?.logo_url || bizSettings?.logo_url || null,
        address: bizSettings?.address || null,
        phone: bizSettings?.phone || null,
        email: bizSettings?.email || null,
        nif: bizSettings?.nif || null
      });
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

  const checkDrugInteractions = (items: any[]) => {
    const names = items.map(i => i.name.toLowerCase());
    const warnings: string[] = [];

    // Check for acetaminophen duplication
    const hasAcetaminophen = names.some(n => n.includes("acétaminophène") || n.includes("acetaminophen") || n.includes("efferalgan") || n.includes("doliprane"));
    const hasParacetamol = names.some(n => n.includes("paracétamol") || n.includes("paracetamol"));
    if (hasAcetaminophen && hasParacetamol) {
      warnings.push("Risque de double médication / surdosage : Plus d'un produit contient du paracétamol (Acétaminophène).");
    }

    // Check for double NSAID
    const hasIbuprofen = names.some(n => n.includes("ibuprofène") || n.includes("ibuprofen") || n.includes("advil"));
    const hasAspirin = names.some(n => n.includes("aspirine") || n.includes("aspirin") || n.includes("aspegic"));
    if (hasIbuprofen && hasAspirin) {
      warnings.push("Interaction AINS majeure : L'association de plusieurs anti-inflammatoires non stéroïdiens (ex: Ibuprofène + Aspirine) augmente fortement le risque d'hémorragie digestive.");
    }

    return warnings;
  };

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
            {filteredProducts.map(p => {
              const visual = getProductVisual(p.name, p.form || "", p.image_url);
              return (
                <Card key={p.id} className="group cursor-pointer hover:border-blue-500 hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col h-full bg-card" onClick={() => addToCart(p)}>
                  {/* Visual Header representing the medication form */}
                  <div className={`h-24 bg-gradient-to-br ${visual.bg} border-b ${visual.border} flex items-center justify-center relative overflow-hidden`}>
                    {visual.element}
                    <span className="absolute top-2 right-2 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-background/90 text-muted-foreground border border-border/80">
                      {visual.tag}
                    </span>
                  </div>
                  <CardContent className="p-3.5 flex flex-col flex-1 justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm leading-tight text-foreground line-clamp-2 min-h-[2.5rem] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{p.form}</p>
                    </div>
                    <div className="flex justify-between items-end mt-auto">
                      <span className="text-[11px] font-bold bg-muted text-muted-foreground px-2 py-1 rounded border border-border/40">
                        Stock: {p.total_stock_quantity}
                      </span>
                      {p.requires_prescription && (
                        <span className="text-[9px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Ord.
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <span className="text-lg font-bold">Total à Payer</span>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{format(totalAmount)}</span>
            </div>

            {/* Clinical Alerts / Drug Interactions */}
            {cart.length > 0 && (() => {
              const warnings = checkDrugInteractions(cart);
              if (warnings.length === 0) return null;
              return (
                <div className="space-y-1.5 p-3 rounded-lg border border-amber-200 bg-amber-50/90 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs animate-pulse">
                  {warnings.map((w, index) => (
                    <div key={index} className="flex gap-2 items-start font-medium">
                      <span className="shrink-0 text-sm">⚠️</span>
                      <p>{w}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

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
