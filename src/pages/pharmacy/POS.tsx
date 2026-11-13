import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Search, ShoppingCart, Trash2, Plus, Minus, User, FileText, Printer, Pill, Droplet, Layers, Sparkles, Activity, AlertTriangle, RotateCcw, RefreshCw, Lock } from "lucide-react";
import type { PharmacyProduct, PharmacyCustomer, PharmacyPrescription } from "@/modules/pharmacy/types";
import { productService } from "@/modules/pharmacy/services/productService";
import { salesService } from "@/modules/pharmacy/services/salesService";
import { ReturnProductDialog } from "@/modules/pharmacy/components/ReturnProductDialog";
import { getOpenRegisterForCurrentUser } from "@/modules/pharmacy/services/registerService";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { ReceiptTemplate, ReceiptData } from "@/components/printing/ReceiptTemplate";
import { printReceipt } from "@/lib/print-utils";
import { getBusinessSettings } from "@/modules/auto-parts/services/businessSettings";
import { getStoredStaffGender } from "@/modules/pharmacy/services/staffService";

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
    element: <Pill className="w-8 h-8 text-primary transition-transform duration-300 group-hover:scale-110" />,
    bg: "from-primary/10 to-primary/5",
    border: "border-primary/20",
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
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedPrescription, setSelectedPrescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [amountReceivedInput, setAmountReceivedInput] = useState("");
  const [lastSale, setLastSale] = useState<any>(null);
  const [receiptSnapshot, setReceiptSnapshot] = useState<ReceiptData | null>(null);
  const [openRegister, setOpenRegister] = useState<{ id: string; name: string } | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);

  const businessId = usePharmacyBusinessId();

  useEffect(() => {
    if (businessId) {
      loadData(businessId);
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId || !profile?.id) {
      setOpenRegister(null);
      return;
    }

    let mounted = true;
    getOpenRegisterForCurrentUser(businessId, profile.id)
      .then((register) => {
        if (mounted) setOpenRegister(register ? { id: register.id, name: register.name } : null);
      })
      .catch(() => {
        if (mounted) setOpenRegister(null);
      });

    return () => {
      mounted = false;
    };
  }, [businessId, profile?.id]);

  const loadData = async (bizId: string) => {
    setLoading(true);
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
      setProducts(prods); // Afficher tous les produits du catalogue dans la caisse
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
    } finally {
      setLoading(false);
    }
  };

  const handleImportCatalog = async () => {
    if (!businessId) return;
    setIsImporting(true);
    try {
      await productService.importStandardCatalog(businessId);
      toast.success("Catalogue standard importé avec succès !");
      await loadData(businessId);
    } catch (e: any) {
      toast.error("Erreur lors de l'importation : " + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.barcode?.includes(searchQuery)
  );

  const addToCart = (product: PharmacyProduct) => {
    const existing = cart.find(item => item.product_id === product.id);
    const stockQty = Number(product.total_stock_quantity || 0);

    // Rupture de stock : la vente est bloquée.
    if (stockQty <= 0) {
      toast.error(`Rupture de stock : ${product.name} n'est pas disponible à la vente.`);
      return;
    }

    if (existing) {
      if (existing.quantity + 1 > stockQty) {
        toast.warning(`Stock insuffisant pour ${product.name} : ${stockQty} disponible(s).`);
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
        max_stock: stockQty
      }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQ = item.quantity + delta;
        if (newQ <= 0) return item;
        if (delta > 0 && item.max_stock && newQ > item.max_stock) {
          toast.warning(`Stock insuffisant pour ${item.name} : ${item.max_stock} disponible(s).`);
          return item;
        }
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

  const completeCheckout = async (receivedAmount: number) => {
    if (cart.length === 0) return false;

    setIsProcessing(true);
    try {
      // Revalider le stock au moment de valider la vente : le stock a pu changer
      // depuis l'ajout au panier (autre vente, réception, etc.).
      const freshProducts = await productService.getProducts(businessId || undefined);
      const stockById = new Map(
        freshProducts.map(p => [p.id, Number(p.total_stock_quantity) || 0])
      );

      for (const item of cart) {
        const available = stockById.get(item.product_id) ?? 0;
        if (available < item.quantity) {
          toast.error(
            `Stock insuffisant pour ${item.name} : ${available} disponible(s), ${item.quantity} demandé(s).`
          );
          if (businessId) loadData(businessId);
          return false;
        }
      }

      const currentRegister = businessId
        ? await getOpenRegisterForCurrentUser(businessId, profile?.id).catch(() => null)
        : null;

      if (!currentRegister) {
        toast.error("Encaissement impossible : aucune caisse ouverte n'est assignée à votre nom.");
        return false;
      }

      const changeGiven = Math.max(0, receivedAmount - totalAmount);
      const salePayload = {
        customer_id: selectedCustomer && selectedCustomer !== "none" ? selectedCustomer : null,
        prescription_id: selectedPrescription || null,
        register_id: currentRegister.id,
        created_by: profile?.id || null,
        subtotal: totalAmount,
        tax_amount: 0,
        discount_amount: 0,
        total: totalAmount,
        payment_method: paymentMethod as any,
        payment_status: "paid" as const,
        notes: changeGiven > 0
          ? `Reçu: ${receivedAmount.toFixed(2)} | Rendu: ${changeGiven.toFixed(2)}`
          : null,
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
          cashierName: profile?.full_name || (getStoredStaffGender(businessId || "", profile?.id) === "F" ? "Caissière" : "Caissier"),
          cashierGender: (profile as any)?.gender || getStoredStaffGender(businessId || "", profile?.id),
          cashierLabel: ((profile as any)?.gender || getStoredStaffGender(businessId || "", profile?.id)) === "F" ? "Caissière" : "Caissier",
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
          amountTendered: changeGiven > 0 ? receivedAmount : undefined,
          changeGiven: changeGiven > 0 ? changeGiven : undefined
        },
        currencyCode: "HTG"
      };

      setLastSale(newSale);
      setReceiptSnapshot(snapshot);
      setCartSheetOpen(false);
      setShowReceipt(true);

      toast.success("Vente effectuée avec succès !");
      setCart([]);
      setSelectedCustomer("");
      setSelectedPrescription("");
      if (businessId) loadData(businessId); // Reload stock
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const isCashPayment = paymentMethod === "cash";
  const receivedAmount = Number(amountReceivedInput) || 0;
  const changeAmount = Math.max(0, receivedAmount - totalAmount);
  const isPaymentAmountValid = isCashPayment
    ? receivedAmount >= totalAmount - 0.001
    : true;

  const openPaymentDialog = () => {
    if (cart.length === 0) {
      toast.error("Le panier est vide.");
      return;
    }
    if (!openRegister) {
      toast.error("Encaissement bloqué : vous n'avez aucune caisse ouverte assignée à votre nom. Veuillez demander à votre gérant de vous ouvrir ou assigner une caisse.");
      return;
    }
    if (requiresPrescription && !selectedPrescription) {
      toast.error("Cette vente contient des médicaments sur ordonnance. Veuillez lier une ordonnance valide.");
      return;
    }
    setAmountReceivedInput(totalAmount.toFixed(2));
    setCartSheetOpen(false);
    setPaymentDialogOpen(true);
  };

  const confirmPayment = async () => {
    if (!isPaymentAmountValid) {
      toast.error("Le montant reçu est inférieur au total à payer.");
      return;
    }
    const received = isCashPayment ? receivedAmount : totalAmount;
    const success = await completeCheckout(received);
    if (success) {
      setPaymentDialogOpen(false);
      setAmountReceivedInput("");
    }
  };

  const quickCashAmounts = (() => {
    const total = Math.ceil(totalAmount);
    if (total <= 0) return [500, 1000, 1500, 2000];

    const suggestions: number[] = [total];

    if (total < 500) {
      if (total < 100) suggestions.push(100);
      if (total < 250) suggestions.push(250);
      suggestions.push(500);
    }

    const step = total >= 10000 ? 5000 : total >= 2500 ? 1000 : 500;
    let candidate = Math.ceil(total / step) * step;
    if (candidate <= total) {
      candidate += step;
    }

    while (suggestions.length < 6) {
      if (!suggestions.includes(candidate) && candidate >= total) {
        suggestions.push(candidate);
      }
      candidate += step;
    }

    const exact = suggestions[0];
    const roundedAbove = Array.from(new Set(suggestions.slice(1)))
      .filter((v) => v >= total)
      .sort((a, b) => a - b);

    const result = [exact, ...roundedAbove].filter((v, i, self) => self.indexOf(v) === i);
    return result.slice(0, 5);
  })();

  const handlePrint = async () => {
    if (receiptRef.current) {
      await printReceipt(receiptRef.current, `ticket-${lastSale?.receipt_number || "sale"}`);
    }
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const renderCartPanel = ({ embedded = false }: { embedded?: boolean } = {}) => (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden bg-card ${
        embedded ? "" : "rounded-xl border border-border/60 shadow-sm"
      }`}
    >
      {!embedded && (
        <div className="shrink-0 p-4 border-b border-border/60 bg-muted/30 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Panier Actuel</h2>
          {openRegister && (
            <span className="ml-auto text-[11px] font-medium bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">
              {openRegister.name}
            </span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
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

      <div className="p-4 border-t border-border/60 bg-muted/30 shrink-0 max-h-[65%] flex flex-col min-h-0">

        <div className="space-y-4 overflow-y-auto min-h-0 pr-1">
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
          <span className="text-2xl font-black text-primary">{format(totalAmount)}</span>
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
        {!openRegister && (
          <div className="mt-3 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Lock className="h-4 w-4 shrink-0" />
              Encaissement bloqué
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Aucune caisse ouverte n'est assignée à votre nom. Vous ne pouvez pas valider de vente tant qu'une caisse ne vous est pas affectée.
            </p>
          </div>
        )}
        </div>

        <Button 
          className="mt-4 w-full shrink-0 h-12 text-lg font-bold bg-primary hover:bg-primary-dark text-primary-fg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
          onClick={openPaymentDialog} 
          disabled={cart.length === 0 || isProcessing || !openRegister}
        >
          {isProcessing ? "Encaissement..." : !openRegister ? "Encaissement bloqué (Caisse fermée)" : "Encaisser & Facturer"}
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardLayout role="salon_admin" title="Point de Vente (Caisse)" subtitle="Vente au comptoir">
      <div className="flex flex-col gap-3 h-[calc(100vh-8.5rem)] min-h-0 pb-20 lg:pb-0">

        {!openRegister && (
          <div className="shrink-0 flex flex-wrap items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Encaissement bloqué : Aucune caisse ouverte n'est assignée à votre nom.
            </span>
            <span className="text-xs text-destructive/80 hidden md:inline">
              (Les ventes ne peuvent être validées que si vous êtes rattaché à une caisse ouverte)
            </span>
            <Link
              to="/pharmacie/registers"
              className="ml-auto font-bold underline underline-offset-2 hover:opacity-80"
            >
              Voir les caisses
            </Link>
          </div>
        )}

        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">

          {/* LEFT PANEL : PRODUCTS CATALOG */}
          <div className="flex-1 flex flex-col min-h-0 h-full">
            <div className="flex shrink-0 items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher un médicament (Nom, DCI, Code barre)..." 
                  className="pl-10 text-base py-5 shadow-sm border-border/60 bg-card"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="h-[46px] shrink-0 gap-2"
                onClick={() => setReturnOpen(true)}
                title="Retourner un produit à partir du numéro de reçu"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Retour produit</span>
              </Button>
            </div>

            {/* SEPARATE SCROLLABLE CONTAINER */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  <p>Chargement des médicaments...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5 my-auto text-center">
                  <Pill className="h-12 w-12 text-primary mb-3 animate-bounce" />
                  <h3 className="text-lg font-bold mb-1">Catalogue de médicaments vide</h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-5">
                    Cette pharmacie n'a pas encore de médicaments enregistrés dans son catalogue. Vous pouvez importer instantanément plus de 150 médicaments essentiels standards.
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button
                      onClick={handleImportCatalog}
                      disabled={isImporting}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm"
                    >
                      <RefreshCw className={`h-4 w-4 ${isImporting ? "animate-spin" : ""}`} />
                      {isImporting ? "Importation en cours..." : "Importer le catalogue standard (+150 produits)"}
                    </Button>
                    <Button variant="outline" asChild>
                      <Link to="/pharmacie/products">Gérer le catalogue</Link>
                    </Button>
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <p className="font-medium text-base">Aucun médicament ne correspond à « {searchQuery} »</p>
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")} className="mt-2 text-primary">
                    Effacer la recherche
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map(p => {
                    const visual = getProductVisual(p.name, p.form || "", p.image_url);
                    const stock = Number(p.total_stock_quantity || 0);
                    const minStock = Number(p.min_stock_alert || 0);
                    const stockClass = stock <= 0
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : stock <= minStock
                        ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                        : "bg-primary/10 text-primary border-primary/20";
                    return (
                      <Card key={p.id} className={`group transition-all duration-300 overflow-hidden flex flex-col bg-card border-border/60 ${stock > 0 ? "cursor-pointer hover:border-primary hover:shadow-md" : "opacity-70"}`} onClick={() => addToCart(p)}>
                        {/* Visual Header representing the medication form */}
                        <div className={`h-20 bg-gradient-to-br ${visual.bg} border-b ${visual.border} flex items-center justify-center relative overflow-hidden shrink-0`}>
                          {visual.element}
                          <span className="absolute top-1.5 right-1.5 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-background/90 text-muted-foreground border border-border/80">
                            {visual.tag}
                          </span>
                        </div>
                        <CardContent className="p-3 flex flex-col flex-1 justify-between gap-2.5">
                          <div>
                            <h3 className="font-bold text-sm leading-tight text-foreground line-clamp-2 min-h-[2.2rem] group-hover:text-primary transition-colors">{p.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.form}</p>
                          </div>
                          <div className="flex justify-between items-end mt-auto pt-2 border-t border-border/40">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prix</p>
                              <p className="text-sm font-black text-primary leading-tight">
                                {Number(p.sale_price) > 0 ? format(p.sale_price) : "0,00 G"}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {p.requires_prescription && (
                                <span className="text-[9px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <FileText className="w-2.5 h-2.5" /> Ord.
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${stockClass}`}>
                                {stock > 0 ? `Stock: ${stock}` : "Rupture"}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL : CART & CHECKOUT (desktop) */}
          <div className="hidden lg:flex w-80 xl:w-96 shrink-0 flex-col h-full min-h-0">
            {renderCartPanel()}
          </div>

        </div>
      </div>

      {/* Barre mobile : le panier reste accessible sans suivre la liste des produits */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {cartItemCount} article(s) dans le panier
            </p>
            <p className="text-lg font-bold text-primary">{format(totalAmount)}</p>
          </div>
          <Button
            className="h-12 gap-2 bg-primary px-5 text-base font-bold text-primary-fg hover:bg-primary-dark"
            onClick={() => setCartSheetOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            Panier
          </Button>
        </div>
      </div>

      <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
        <SheetContent side="bottom" className="flex h-[88dvh] flex-col gap-0 rounded-t-2xl p-0">
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Panier & Encaissement
              {openRegister && (
                <span className="ml-auto text-[11px] font-medium bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">
                  {openRegister.name}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 p-4">
            {renderCartPanel({ embedded: true })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Popup d'encaissement : montant reçu et monnaie à rendre */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Encaissement
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total à payer
              </p>
              <p className="text-3xl font-black text-primary">{format(totalAmount)}</p>
            </div>

            {isCashPayment ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="amount-received">Montant reçu du client</Label>
                  <Input
                    id="amount-received"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="h-14 text-right text-2xl font-bold"
                    value={amountReceivedInput}
                    onChange={(e) => setAmountReceivedInput(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    autoFocus
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickCashAmounts.map((amount) => {
                    const isSelected = Math.abs(Number(amountReceivedInput) - amount) < 0.01;
                    return (
                      <Button
                        key={amount}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={`flex-1 min-w-[75px] h-9 text-xs font-bold transition-all ${
                          isSelected ? "shadow-sm scale-[1.02]" : "hover:border-primary/50"
                        }`}
                        onClick={() => setAmountReceivedInput(amount.toFixed(2))}
                      >
                        {format(amount)}
                      </Button>
                    );
                  })}
                </div>

                <div
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    isPaymentAmountValid
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-destructive/30 bg-destructive/10"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {isPaymentAmountValid ? "Monnaie à rendre" : "Montant insuffisant"}
                  </span>
                  <span
                    className={`text-xl font-black ${
                      isPaymentAmountValid
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    }`}
                  >
                    {isPaymentAmountValid
                      ? format(changeAmount)
                      : format(Math.max(0, totalAmount - receivedAmount))}
                  </span>
                </div>
              </>
            ) : (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Paiement par{" "}
                {paymentMethod === "card"
                  ? "carte bancaire"
                  : paymentMethod === "moncash"
                    ? "MonCash"
                    : "un autre moyen"}{" "}
                : le montant exact sera encaissé.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
              disabled={isProcessing}
            >
              Annuler
            </Button>
            <Button
              className="h-11 min-w-[170px] bg-primary text-primary-fg hover:bg-primary-dark"
              onClick={confirmPayment}
              disabled={isProcessing || (isCashPayment && !isPaymentAmountValid)}
            >
              {isProcessing ? "Encaissement..." : "Valider & Facturer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogTitle className="text-center font-bold text-foreground">Fiche de Vente (Ticket)</DialogTitle>
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
            <Button variant="outline" className="text-foreground" onClick={() => { setShowReceipt(false); setReceiptSnapshot(null); setLastSale(null); }}>
              Fermer
            </Button>
            <Button onClick={handlePrint} className="bg-primary hover:bg-primary-dark text-primary-fg gap-2 shadow-sm">
              <Printer className="w-4 h-4" />
              Imprimer / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReturnProductDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        businessId={businessId}
        onCompleted={() => {
          if (businessId) loadData(businessId);
        }}
      />
    </DashboardLayout>
  );
}
