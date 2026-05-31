import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { printReceipt as printReceiptPdf } from "@/lib/print-utils";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Minus, Trash2, Printer, Download, Search,
  Package, Scissors, CreditCard, Banknote, Wallet, User,
  Gift, Percent, Tag, Barcode, UserCog, X, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveBranchId } from "@/lib/branch";
import { ReceiptTemplate } from "@/components/ui/ReceiptTemplate";
import { PromotionBadge } from "@/components/modules/salon/PromotionBadge";
import {
  addItemToCart,
  buildPaymentSplits,
  calculateCartTotals,
  removeCartItem,
  updateCartQuantity,
  validatePayment,
} from "@/modules/salon/pos";
import type { PaymentMethod } from "@/modules/salon/types";
import type { PaymentSplit } from "@/modules/salon/pos";
import { recordStockMovement } from "@/modules/salon/inventory";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";

interface CatalogItem {
  id: string;
  name: string;
  unit_price: number;
  category?: string;
  type: "product" | "service";
  stock?: number;
  barcode?: string;
}

interface CartItem {
  key: string;
  type: "product" | "service";
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  category?: string;
  promotion_applied?: boolean;
  promotion_name?: string;
  discount?: number;
}

interface Promotion {
  id: string;
  name: string;
  description?: string;
  promotion_type: "percentage" | "fixed_amount" | "bundle" | "combo";
  discount_value?: number;
  discount_percentage?: number;
  items_config: { services?: string[]; products?: string[] };
  minimum_quantity?: number;
}

interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  slogan?: string;
  logo_url?: string;
  tax_number?: string;
}

interface EmployeeInfo {
  id: string;
  name: string;
}

export default function POSPage() {
  const { user, profile: authProfile, employeeSession } = useAuth();
  const { currencyCode, format } = useCurrency();
  const { branchId } = useActiveBranchId(authProfile?.business_id ?? null);
  const { data: branches = [] } = useBusinessBranches();
  const activeBranchId = useMemo(() => {
    const validBranchId = branchId && branches.some((branch) => branch.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches]);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([
    { method: "cash", amount: 0 },
    { method: "moncash", amount: 0 },
    { method: "natcash", amount: 0 },
    { method: "card", amount: 0 },
  ]);
  // ── Client search state
  interface ClientResult { id: string; name: string; phone: string; visit_count: number; }
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // ── New-client quick-create modal
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientSaving, setNewClientSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"products" | "services">("products");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Modal options
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedServiceForOptions, setSelectedServiceForOptions] = useState<CatalogItem | null>(null);
  const [selectedServiceOptions, setSelectedServiceOptions] = useState<string[]>([]);

  // Employee & Business
  const [employees, setEmployees] = useState<EmployeeInfo[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: "Mon Salon", address: "123 Rue Principale", phone: "+509 1234 5678",
  });

  const loadData = async (branchIdToUse: string | null = activeBranchId) => {
    try {
      if (!branchIdToUse) {
        setProducts([]);
        setServices([]);
        setPromotions([]);
        return;
      }
      let productsQuery = supabase.from("salon_products").select("id, name, unit_price, category, quantity_in_stock, barcode").eq("is_active", true);
      let servicesQuery = supabase.from("salon_services").select("id, name, price_htg, category_id, metadata").eq("is_active", true);
      let promotionsQuery = supabase.from("salon_promotions").select("*").eq("is_active", true).lte("valid_from", new Date().toISOString().split("T")[0]).gte("valid_until", new Date().toISOString().split("T")[0]);

      productsQuery = productsQuery.eq("branch_id", branchIdToUse);
      servicesQuery = servicesQuery.eq("branch_id", branchIdToUse);
      promotionsQuery = promotionsQuery.eq("branch_id", branchIdToUse);

      const [{ data: p }, { data: s }, { data: promos }] = await Promise.all([
        productsQuery.order("name"),
        servicesQuery.order("name"),
        promotionsQuery,
      ]);
      setProducts((p || []).map(x => ({ ...x, unit_price: Number(x.unit_price || 0), stock: x.quantity_in_stock, type: "product" as const })));
      setServices((s || []).map(x => ({ ...x, unit_price: Number(x.price_htg || 0), type: "service" as const })));
      setPromotions((promos || []) as Promotion[]);
    } catch (err) {
      console.error("Erreur chargement POS:", err);
      toast.error("Impossible de charger le catalogue");
    }
  };

  const loadEmployees = async () => {
    try {
      if (!activeBranchId) {
        setEmployees([]);
        return;
      }
      const { data: emp } = await supabase
        .from("salon_employees")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .eq("branch_id", activeBranchId)
        .order("first_name");
      if (emp) {
        setEmployees((emp || []).map((row: any) => ({
          id: row.id,
          name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
        })));
      }
    } catch {}
  };

  // ── Debounced client search
  const searchClients = useCallback(async (q: string) => {
    if (q.length < 2) { setClientResults([]); setShowClientDropdown(false); return; }
    setClientLoading(true);
    try {
      const { data } = await supabase
        .from("salon_customers")
        .select("id, first_name, last_name, phone, visit_count")
        .eq("is_active", true)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(6);
      const results: ClientResult[] = (data || []).map((r: any) => ({
        id: r.id,
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        phone: r.phone || "",
        visit_count: r.visit_count || 0,
      }));
      setClientResults(results);
      setShowClientDropdown(true);
    } catch {
      setClientResults([]);
    } finally {
      setClientLoading(false);
    }
  }, [activeBranchId]);

  // debounce
  const clientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClientQueryChange = (val: string) => {
    setClientQuery(val);
    if (clientSearchTimer.current) clearTimeout(clientSearchTimer.current);
    clientSearchTimer.current = setTimeout(() => searchClients(val), 300);
  };

  const selectClient = (c: ClientResult) => {
    setSelectedClient(c);
    setClientQuery("");
    setClientResults([]);
    setShowClientDropdown(false);
  };

  const deselectClient = () => {
    setSelectedClient(null);
    setClientQuery("");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const saveNewClient = async () => {
    if (!newClientName.trim() || !newClientPhone.trim()) {
      toast.error("Nom et téléphone requis");
      return;
    }
    if (!activeBranchId) { toast.error("Aucune branche sélectionnée"); return; }
    setNewClientSaving(true);
    try {
      const parts = newClientName.trim().split(" ");
      const { data, error } = await supabase
        .from("salon_customers")
        .insert([{
          branch_id: activeBranchId,
          first_name: parts[0],
          last_name: parts.slice(1).join(" ") || null,
          phone: newClientPhone.trim(),
          email: newClientEmail.trim() || null,
        }])
        .select("id, first_name, last_name, phone, visit_count")
        .single();
      if (error) throw error;
      const created: ClientResult = {
        id: data.id,
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
        phone: data.phone || "",
        visit_count: data.visit_count || 0,
      };
      selectClient(created);
      setShowNewClientModal(false);
      setNewClientName(""); setNewClientPhone(""); setNewClientEmail("");
      toast.success(`Client "${created.name}" créé et sélectionné`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setNewClientSaving(false);
    }
  };

  const loadBusinessInfo = async () => {
    if (!user) return;
    try {
      const { data: prof } = await supabase.from("profiles").select("business_id").eq("id", user.id).maybeSingle();
      if (prof?.business_id) {
        const { data: biz } = await supabase.from("businesses").select("id, name, logo_url").eq("id", prof.business_id).maybeSingle();
        const { data: ext } = await supabase.from("salon_business_profiles").select("email, phone, address, whatsapp, slogan, tax_number").eq("business_id", prof.business_id).maybeSingle();
        if (biz) {
          const info: BusinessInfo = {
            name: biz.name || "Mon Salon",
            address: ext?.address || "",
            phone: ext?.phone || "",
            logo_url: biz.logo_url,
          };
          if (ext) {
            info.whatsapp = ext.whatsapp || "";
            info.email = ext.email || "";
            info.slogan = ext.slogan || "";
            info.tax_number = ext.tax_number || "";
          }
          setBusinessInfo(info);
        }
      }
    } catch {}
  };

  useEffect(() => {
    void loadData(activeBranchId);
    void loadEmployees();
    void loadBusinessInfo();
    // reset client search if branch changes
    setSelectedClient(null);
    setClientQuery("");
  }, [user, activeBranchId]);

  const detectPromotions = (cartItems: CartItem[]): CartItem[] => {
    return cartItems.map(item => {
      const applicablePromo = promotions.find(p => {
        if (p.promotion_type === "percentage" || p.promotion_type === "fixed_amount") {
          if (item.type === "product" && p.items_config?.products?.includes(item.item_id)) return true;
          if (item.type === "service" && p.items_config?.services?.includes(item.item_id)) return true;
        }
        if (p.promotion_type === "bundle" && p.minimum_quantity && item.quantity >= p.minimum_quantity) return true;
        if (p.promotion_type === "combo") {
          const sameTypeItems = cartItems.filter(ci => ci.type === item.type);
          if (p.minimum_quantity && sameTypeItems.length >= p.minimum_quantity) return true;
        }
        return false;
      });

      if (applicablePromo) {
        let discount = 0;
        if (applicablePromo.promotion_type === "percentage" && applicablePromo.discount_percentage) {
          discount = item.unit_price * item.quantity * (applicablePromo.discount_percentage / 100);
        } else if (applicablePromo.promotion_type === "fixed_amount" && applicablePromo.discount_value) {
          discount = applicablePromo.discount_value;
        } else if (applicablePromo.promotion_type === "bundle" && applicablePromo.discount_value) {
          discount = applicablePromo.discount_value;
        }
        return { ...item, promotion_applied: true, promotion_name: applicablePromo.name, discount };
      }
      return { ...item, promotion_applied: false, discount: 0 };
    });
  };

  const handleItemClick = (item: CatalogItem, type: "product" | "service") => {
    if (type === "service" && Array.isArray(item.metadata?.addon_options) && item.metadata.addon_options.length > 0) {
      setSelectedServiceForOptions(item);
      setSelectedServiceOptions([]);
      setOptionsModalOpen(true);
      return;
    }
    addToCart(item, type);
  };

  const confirmServiceOptions = () => {
    if (!selectedServiceForOptions) return;
    const serviceAddons = selectedServiceForOptions.metadata?.addon_options || [];
    const chosenAddons = serviceAddons.filter((o: any) => selectedServiceOptions.includes(o.name));
    const optionsText = chosenAddons.map((o: any) => o.name).join(", ");
    const extraCost = chosenAddons.reduce((sum: number, o: any) => sum + Number(o.extra_cost || 0), 0);
    
    addToCart(selectedServiceForOptions, "service", { optionsText, extraCost });
    setOptionsModalOpen(false);
  };

  const addToCart = (item: CatalogItem, type: "product" | "service", customOptions?: { optionsText?: string, extraCost?: number }) => {
    setCart(prev => addItemToCart(prev, item, type, promotions, customOptions));
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart(prev => updateCartQuantity(prev, key, delta, promotions));
  };

  const removeFromCart = (key: string) => {
    setCart(prev => removeCartItem(prev, key, promotions));
  };

  const hasServices = useMemo(() => cart.some(i => i.type === "service"), [cart]);

  const totals = useMemo(() => calculateCartTotals(cart, discountPercent), [cart, discountPercent]);
  const { subtotal, totalDiscount, total } = totals;
  const resolvedPaymentSplits = useMemo(
    () => buildPaymentSplits(paymentMethod, total, paymentSplits),
    [paymentMethod, paymentSplits, total]
  );
  const paymentValidation = useMemo(
    () => validatePayment(total, resolvedPaymentSplits),
    [resolvedPaymentSplits, total]
  );

  const updatePaymentSplit = (method: PaymentSplit["method"], amount: number) => {
    setPaymentSplits((prev) =>
      prev.map((split) => split.method === method ? { ...split, amount: Math.max(0, amount) } : split)
    );
  };

  const getCommissionRate = async (employeeId: string, serviceId: string): Promise<{ type: string; value: number } | null> => {
    const { data: rules } = await supabase
      .from("commission_rules")
      .select("rate_type, rate_value")
      .eq("employee_id", employeeId)
      .eq("service_id", serviceId)
      .eq("is_active", true)
      .maybeSingle();

    if (rules) return { type: rules.rate_type, value: Number(rules.rate_value) };

    const { data: global } = await supabase
      .from("commission_rules")
      .select("rate_type, rate_value")
      .eq("employee_id", employeeId)
      .is("service_id", null)
      .eq("is_active", true)
      .maybeSingle();

    if (global) return { type: global.rate_type, value: Number(global.rate_value) };

    const { data: emp } = await supabase
      .from("salon_employees")
      .select("commission_percentage")
      .eq("id", employeeId)
      .maybeSingle();

    if (emp?.commission_percentage) {
      return { type: "percentage", value: Number(emp.commission_percentage) };
    }

    return null;
  };

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Panier vide");
    if (paymentMethod === "mixed" && !paymentValidation.isPaid) {
      return toast.error(`Paiement incomplet. Reste à payer: ${format(paymentValidation.remaining)}`);
    }

    try {
      const cashierName = employeeSession?.full_name || authProfile?.full_name || user?.email || "Caissier";
      const cashierId = employeeSession?.id || null;
      let businessId = authProfile?.business_id ?? null;
      if (!businessId && user?.id) {
        const { data: profileRow } = await supabase.from("profiles").select("business_id").eq("id", user.id).maybeSingle();
        businessId = profileRow?.business_id ?? null;
      }

      if (!activeBranchId) {
        throw new Error("Sélectionnez une branche avant d'encaisser");
      }

      const { data: sale, error: saleError } = await supabase
        .from("salon_sales")
        .insert([{
          business_id: businessId,
          branch_id: activeBranchId,
          customer_name: selectedClient?.name || null,
          customer_id: selectedClient?.id || null,
          payment_method: paymentMethod === "mixed" ? "cash" : paymentMethod,
          total_amount: total,
          discount_amount: totalDiscount,
          discount_percentage: discountPercent,
          tax_amount: 0,
          employee_id: selectedEmployee || null,
          cashier_name: cashierName,
          cashier_id: cashierId,
        }])
        .select("id, sale_number, created_at")
        .single();

      if (saleError || !sale?.id) throw new Error(saleError?.message || "Vente impossible");

      const items = cart.map(i => ({
        sale_id: sale.id,
        branch_id: activeBranchId,
        ...(i.type === "product" ? { product_id: i.item_id } : {}),
        ...(i.type === "service" ? { service_id: i.item_id } : {}),
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.quantity * i.unit_price - (i.discount || 0),
      }));

      const { error: itemErr } = await supabase.from("salon_sale_items").insert(items);
      if (itemErr) throw new Error(itemErr.message);

      if (businessId) {
        await supabase.from("salon_sale_payments").insert(
          resolvedPaymentSplits.map((split) => ({
              sale_id: sale.id,
              business_id: businessId,
              branch_id: activeBranchId,
              payment_method: split.method,
              amount: split.amount,
              currency_code: currencyCode,
          }))
        ).then(({ error }) => {
          if (error) console.warn("Paiements détaillés non enregistrés:", error.message);
        });
      }

      for (const item of cart) {
        if (item.type === "product") {
          const product = products.find((p) => p.id === item.item_id);
          const previousStock = Number(product?.stock ?? 0);
          const nextStock = Math.max(0, previousStock - item.quantity);

          try {
            await supabase
              .from("salon_products")
              .update({ quantity_in_stock: nextStock })
              .eq("id", item.item_id);
          } catch { /* ignore stock update error */ }

          if (businessId) {
            try {
              await recordStockMovement({
                business_id: businessId,
                branch_id: activeBranchId,
                product_id: item.item_id,
                movement_type: "sale",
                quantity_delta: -item.quantity,
                reason: `Vente POS #${sale.sale_number || sale.id}`,
                reference_id: sale.id,
              });
            } catch (err: any) {
              console.warn("Mouvement stock produit non enregistré:", err.message);
            }
          }
        }

      }

      // Calculate commissions
      if (selectedEmployee && hasServices) {
        for (const item of cart) {
          if (item.type === "service" && businessId) {
            const rate = await getCommissionRate(selectedEmployee, item.item_id);
            if (rate) {
              const saleAmount = item.quantity * item.unit_price;
              const commissionAmount = rate.type === "percentage"
                ? saleAmount * (rate.value / 100)
                : rate.value;

              await supabase.from("commission_transactions").insert({
                business_id: businessId,
                branch_id: activeBranchId,
                employee_id: selectedEmployee,
                sale_id: sale.id,
                service_id: item.item_id,
                rate_type: rate.type,
                rate_value: rate.value,
                sale_amount: saleAmount,
                commission_amount: commissionAmount,
                currency_code: currencyCode,
                status: "pending",
              });
            }
          }
        }
      }

      toast.success("Vente enregistrée avec succès !");

      setLastSale({ ...sale, items: cart, customer: selectedClient?.name || "", payment: paymentMethod, cashier_name: cashierName });
      setShowReceipt(true);
      setCart([]);
      setSelectedClient(null);
      setClientQuery("");
      setDiscountPercent(0);
      setPaymentMethod("cash");
      setPaymentSplits([
        { method: "cash", amount: 0 },
        { method: "moncash", amount: 0 },
        { method: "natcash", amount: 0 },
        { method: "card", amount: 0 },
      ]);
      await loadData(activeBranchId);
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Erreur lors de l'enregistrement");
    }
  };

  const handlePrintReceipt = async () => {
    if (!receiptRef.current) return;
    await printReceiptPdf(receiptRef.current, `recu-${lastSale?.sale_number || Date.now()}`);
    toast.success("Reçu PDF téléchargé !");
  };

  const currentItems = activeTab === "products" ? products : services;
  const filteredItems = currentItems.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.barcode || "").includes(searchTerm)
  );

  const hasActivePromotions = promotions.length > 0;

  return (
    <DashboardLayout role="salon_admin" title="POS / Caisse" subtitle="Encaissement rapide avec promotions et commissions">
      <StaggerContainer className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
        <StaggerItem className="flex-1 flex flex-col min-w-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant={activeTab === "products" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("products")} className="gap-1">
                    <Package className="h-4 w-4" /> Produits
                  </Button>
                  <Button variant={activeTab === "services" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("services")} className="gap-1">
                    <Scissors className="h-4 w-4" /> Prestations
                  </Button>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher ou scan code-barres..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
                  <Barcode className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {hasActivePromotions && (
                <div className="flex flex-wrap gap-1.5">
                  {promotions.map(p => (
                    <PromotionBadge key={p.id} type={p.promotion_type} value={p.discount_percentage || p.discount_value} />
                  ))}
                  <span className="text-xs text-muted-foreground self-center ml-1">
                    Promotions actives — appliquées automatiquement
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredItems.map((item: any) => (
                    <Card key={item.id} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-soft active:scale-[0.98]"
                      onClick={() => handleItemClick(item, activeTab === "products" ? "product" : "service")}>
                      <CardContent className="p-3">
                        <div className={cn(
                          "w-full h-14 rounded-lg flex items-center justify-center mb-2",
                          activeTab === "products" ? "bg-primary/10 text-primary" :
                          "bg-info/10 text-info"
                        )}>
                          {activeTab === "products" ? <Package className="h-6 w-6" /> : <Scissors className="h-6 w-6" />}
                        </div>
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.stock !== undefined ? `Stock: ${item.stock}` : ""}
                        </p>
                        <p className="text-primary font-semibold mt-1 text-sm">{format(item.unit_price)}</p>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredItems.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground py-8 text-sm">Aucun élément trouvé</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem className="w-full lg:w-96 flex flex-col">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" /> Panier ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 pr-2 -mr-2">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Ajoutez des articles pour commencer</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.key} className={cn(
                        "flex items-center gap-2 p-2 rounded-lg",
                        item.promotion_applied ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" : "bg-muted/40"
                      )}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs text-muted-foreground">{format(item.unit_price)} × {item.quantity}</p>
                            {item.promotion_applied && (
                              <Badge variant="secondary" className="text-[10px] px-1 h-4">
                                <Tag className="h-2.5 w-2.5 mr-0.5" /> Promo
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.key, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.key, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.key)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Employee Selector */}
              {employees.length > 0 && (
                <div className="mt-2">
                  <Label className="text-xs flex items-center gap-1 mb-1">
                    <UserCog className="h-3 w-3" /> Employé
                  </Label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Sélectionner...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <Separator className="my-3" />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{format(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Réduction</span>
                    <span>-{format(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary">{format(total)}</span>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                {/* ── Client (optionnel) ── */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-xs">
                    <User className="h-3 w-3" /> Client <span className="text-muted-foreground font-normal">(optionnel)</span>
                  </Label>

                  {selectedClient ? (
                    /* ── Selected state ── */
                    <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                        {selectedClient.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{selectedClient.name}</span>
                          {selectedClient.visit_count >= 3 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Fidèle
                            </span>
                          )}
                        </div>
                        {selectedClient.phone && (
                          <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>
                        )}
                      </div>
                      <button
                        onClick={deselectClient}
                        className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                        title="Désélectionner"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    /* ── Search state ── */
                    <div className="relative" ref={clientDropdownRef}>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            id="pos-client-search"
                            type="text"
                            value={clientQuery}
                            onChange={e => handleClientQueryChange(e.target.value)}
                            onFocus={() => clientQuery.length >= 2 && setShowClientDropdown(true)}
                            placeholder="Nom ou téléphone..."
                            className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          {clientLoading && (
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                        <button
                          onClick={() => { setNewClientName(""); setNewClientPhone(""); setNewClientEmail(""); setShowNewClientModal(true); }}
                          className="flex items-center gap-1 px-2.5 h-9 text-xs font-medium rounded-md border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-colors whitespace-nowrap"
                          title="Nouveau client"
                        >
                          <Plus className="h-3.5 w-3.5" /> Nouveau
                        </button>
                      </div>

                      {/* Dropdown */}
                      {showClientDropdown && (
                        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                          {clientResults.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-muted-foreground text-center">Aucun client trouvé</p>
                          ) : (
                            clientResults.map(c => (
                              <button
                                key={c.id}
                                onClick={() => selectClient(c)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                              >
                                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                                  {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium truncate">{c.name}</span>
                                    {c.visit_count >= 3 && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                                        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Fidèle
                                      </span>
                                    )}
                                  </div>
                                  {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowDiscount(!showDiscount)}>
                    <Percent className="h-3 w-3" /> Réduction
                  </Button>
                  {showDiscount && (
                    <div className="flex items-center gap-2 mt-2">
                      <Input type="number" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} min={0} max={100} className="w-20" />
                      <span className="text-sm">%</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Paiement</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "cash", label: "Espèces", icon: Banknote },
                      { id: "moncash", label: "MonCash", icon: Wallet },
                      { id: "natcash", label: "NatCash", icon: Wallet },
                      { id: "card", label: "Carte", icon: CreditCard },
                      { id: "mixed", label: "Mixte", icon: CreditCard },
                    ].map(method => {
                      const Icon = method.icon;
                      return (
                        <Button key={method.id} variant={paymentMethod === method.id ? "default" : "outline"}
                          className={cn("justify-start gap-2 h-10", paymentMethod === method.id && "bg-primary")}
                          onClick={() => setPaymentMethod(method.id as PaymentMethod)}>
                          <Icon className="h-4 w-4" />
                          {method.label}
                        </Button>
                      );
                    })}
                  </div>
                  {paymentMethod === "mixed" && (
                    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {paymentSplits.map((split) => (
                          <div key={split.method} className="space-y-1">
                            <Label className="text-[11px]">
                              {split.method === "cash" ? "Espèces" : split.method}
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={split.amount || ""}
                              onChange={(e) => updatePaymentSplit(split.method, Number(e.target.value || 0))}
                              className="h-8 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Payé: {format(paymentValidation.paid)}</span>
                        <span className={paymentValidation.isPaid ? "text-success" : "text-destructive"}>
                          Reste: {format(paymentValidation.remaining)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setCart([])} disabled={cart.length === 0}>
                  Annuler
                </Button>
                <Button onClick={checkout} disabled={cart.length === 0} className="bg-primary h-11 text-base font-semibold">
                  Encaisser • {format(total)}
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <Dialog open={optionsModalOpen} onOpenChange={setOptionsModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Options pour {selectedServiceForOptions?.name}</DialogTitle>
            <DialogDescription>
              Sélectionnez les options supplémentaires.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {selectedServiceForOptions?.metadata?.addon_options?.map((option: any) => (
              <label key={option.name} className="flex items-center justify-between gap-3 text-sm border border-border rounded-md p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary rounded border-input"
                    checked={selectedServiceOptions.includes(option.name)}
                    onChange={(e) => {
                      setSelectedServiceOptions((prev) =>
                        e.target.checked ? [...prev, option.name] : prev.filter((item) => item !== option.name)
                      );
                    }}
                  />
                  <span className="font-medium">{option.name}</span>
                </div>
                <span className="text-muted-foreground text-xs font-semibold">
                  +{format(Number(option.extra_cost || 0))}
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOptionsModalOpen(false)}>Annuler</Button>
            <Button onClick={confirmServiceOptions}>Ajouter au panier</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Reçu #{lastSale?.sale_number || ""}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
                  <Printer className="h-4 w-4" /> Imprimer
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintReceipt} className="gap-1">
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              Consultez le reçu de la vente enregistrée et téléchargez une copie PDF.
            </DialogDescription>
          </DialogHeader>

          <div ref={receiptRef} className="bg-white rounded-lg overflow-hidden border">
            <ReceiptTemplate
              sale={{
                ...lastSale,
                cashier_name: lastSale?.cashier_name,
                customer_name: lastSale?.customer,
                payment_method: lastSale?.payment,
              }}
              items={lastSale?.items?.map((i: any) => ({
                item_name: i.name,
                quantity: i.quantity,
                unit_price: i.unit_price,
                total_price: i.quantity * i.unit_price - (i.discount || 0),
              })) || []}
              salon={businessInfo}
              currencyCode={currencyCode}
              format={format}
              detailed
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowReceipt(false)}>Fermer</Button>
            <Button onClick={handlePrintReceipt}>Télécharger le PDF</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal : Nouveau client rapide ───────────────────────────── */}
      <Dialog open={showNewClientModal} onOpenChange={setShowNewClientModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>
              Créez une fiche client et sélectionnez-la immédiatement pour cette vente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nc-name">Nom complet *</Label>
              <Input
                id="nc-name"
                placeholder="Ex : Marie Dupont"
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-phone">Téléphone *</Label>
              <Input
                id="nc-phone"
                placeholder="Ex : +509 34 56 78 90"
                value={newClientPhone}
                onChange={e => setNewClientPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-email">Email <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input
                id="nc-email"
                type="email"
                placeholder="Ex : marie@example.com"
                value={newClientEmail}
                onChange={e => setNewClientEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowNewClientModal(false)}>Annuler</Button>
            <Button onClick={saveNewClient} disabled={newClientSaving}>
              {newClientSaving ? "Enregistrement..." : "Créer et sélectionner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
