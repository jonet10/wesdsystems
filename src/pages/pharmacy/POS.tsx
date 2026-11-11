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
import { toast } from "sonner";
import { Search, ShoppingCart, Trash2, Plus, Minus, User, FileText, Printer, Pill, Droplet, Layers, Sparkles, Activity, AlertTriangle, RotateCcw } from "lucide-react";
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
  
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedPrescription, setSelectedPrescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [receiptSnapshot, setReceiptSnapshot] = useState<ReceiptData | null>(null);
  const [openRegister, setOpenRegister] = useState<{ id: string; name: string } | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  
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

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (requiresPrescription && !selectedPrescription) {
      toast.error("Cette vente contient des médicaments sur ordonnance. Veuillez lier une ordonnance valide.");
      return;
    }

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
          return;
        }
      }

      const currentRegister = businessId
        ? await getOpenRegisterForCurrentUser(businessId, profile?.id).catch(() => null)
        : null;

      const salePayload = {
        customer_id: selectedCustomer && selectedCustomer !== "none" ? selectedCustomer : null,
        prescription_id: selectedPrescription || null,
        register_id: currentRegister?.id || null,
        created_by: profile?.id || null,
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
      <div className="flex flex-col gap-4 md:h-[calc(100vh-7rem)] md:min-h-0">

        {!openRegister && (
          <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Aucune caisse n'est ouverte à votre nom. Les ventes ne seront pas rattachées à une caisse.
            </span>
            <Link
              to="/pharmacie/registers"
              className="ml-auto font-medium underline underline-offset-2"
            >
              Gérer les caisses
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 min-h-0">

        {/* LEFT PANEL : PRODUCTS CATALOG */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-4 min-h-0">
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Rechercher un médicament (Nom, DCI, Code barre)..." 
                className="pl-10 text-lg py-6 shadow-sm border-border/60 bg-card"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="h-[52px] shrink-0 gap-2"
              onClick={() => setReturnOpen(true)}
              title="Retourner un produit à partir du numéro de reçu"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Retour produit</span>
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
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
                <Card key={p.id} className={`group transition-all duration-300 overflow-hidden flex flex-col h-full bg-card border-border/60 ${stock > 0 ? "cursor-pointer hover:border-primary hover:shadow-md" : "opacity-70"}`} onClick={() => addToCart(p)}>
                  {/* Visual Header representing the medication form */}
                  <div className={`h-24 bg-gradient-to-br ${visual.bg} border-b ${visual.border} flex items-center justify-center relative overflow-hidden`}>
                    {visual.element}
                    <span className="absolute top-2 right-2 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-background/90 text-muted-foreground border border-border/80">
                      {visual.tag}
                    </span>
                  </div>
                  <CardContent className="p-3.5 flex flex-col flex-1 justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm leading-tight text-foreground line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{p.form}</p>
                    </div>
                    <div className="flex justify-between items-end mt-auto">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${stockClass}`}>
                        {stock > 0 ? `Stock: ${stock}` : "Rupture de stock"}
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
              <div className="col-span-full text-center text-muted-foreground py-10">Aucun produit trouvé.</div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL : CART & CHECKOUT */}
        <div className="md:col-span-5 lg:col-span-4 bg-card border border-border/60 rounded-xl flex flex-col shadow-sm min-h-0 overflow-hidden">
          <div className="shrink-0 p-4 border-b border-border/60 bg-muted/30 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Panier Actuel</h2>
            {openRegister && (
              <span className="ml-auto text-[11px] font-medium bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">
                {openRegister.name}
              </span>
            )}
          </div>

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
            </div>

            <Button 
              className="mt-4 w-full shrink-0 h-12 text-lg font-bold bg-primary hover:bg-primary-dark text-primary-fg shadow-md transition-all" 
              onClick={handleCheckout} 
              disabled={cart.length === 0 || isProcessing}
            >
              {isProcessing ? "Encaissement..." : "Encaisser & Facturer"}
            </Button>
          </div>
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
