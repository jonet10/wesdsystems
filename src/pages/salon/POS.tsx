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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { printReceipt as printReceiptPdf } from "@/lib/print-utils";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Minus, Trash2, Printer, Download, Search,
  Package, Scissors, CreditCard, Banknote, Wallet, User,
  Gift, Percent, Tag, Barcode, UserCog, X, Star, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveBranchId } from "@/lib/branch";
import { ReceiptTemplate } from "@/components/ui/ReceiptTemplate";
import { PromotionBadge } from "@/components/modules/salon/PromotionBadge";
import {
  addPendingTabItem,
  cancelPendingTab,
  checkoutPendingTab,
  createPendingTab,
  deletePendingTabItem,
  findClientOptions as findPendingTabClientOptions,
  getPendingTab,
  listPendingTabs,
  updatePendingTabItem,
} from "@/modules/salon/pending-tabs";
import type { PendingTabDetail, PendingTabSummary } from "@/modules/salon/pending-tabs";
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
import { DEFAULT_PLATFORM_TIME_ZONE, getDateKeyInTimeZone } from "@/lib/timezone-date";
import { normalizeEmployeeRole } from "@/lib/employee-role";

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
  pending_item_id?: string | null;
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
  role: string;
}

interface EmployeePosBundleResponse {
  employee: {
    id: string;
    full_name: string;
    role: string;
    branch_id: string;
  };
  branch: {
    id: string;
    business_id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  business: {
    id: string;
    name: string;
    logo_url?: string | null;
  };
  products: Array<{
    id: string;
    name: string;
    unit_price: number;
    category?: string | null;
    quantity_in_stock?: number | null;
    barcode?: string | null;
  }>;
  services: Array<{
    id: string;
    name: string;
    price_htg: number;
    category_id?: string | null;
    metadata?: Record<string, any> | null;
  }>;
  promotions: Array<{
    id: string;
    name: string;
    description?: string | null;
    promotion_type: "percentage" | "fixed_amount" | "bundle" | "combo";
    discount_value?: number | null;
    discount_percentage?: number | null;
    items_config?: { services?: string[]; products?: string[] } | null;
    minimum_quantity?: number | null;
  }>;
  employees: Array<{
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    role?: string | null;
    commission_percentage?: number | null;
    metadata?: Record<string, any> | null;
    is_active?: boolean | null;
  }>;
}

interface PendingTabClientResult {
  id: string;
  name: string;
  phone: string;
  visit_count: number;
}

const EMPTY_PAYMENT_SPLITS: PaymentSplit[] = [
  { method: "cash", amount: 0 },
  { method: "moncash", amount: 0 },
  { method: "natcash", amount: 0 },
  { method: "card", amount: 0 },
];

const mapPendingItemToCart = (item: {
  id: string;
  item_type: "product" | "service";
  item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}): CartItem => ({
  key: `pending-${item.id}`,
  type: item.item_type,
  item_id: item.item_id,
  name: item.item_name,
  quantity: item.quantity,
  unit_price: Number(item.unit_price || 0),
  promotion_applied: false,
  discount: 0,
  pending_item_id: item.id,
});

export default function POSPage() {
  const { user, profile: authProfile, employeeSession } = useAuth();
  const { currencyCode, format } = useCurrency();
  const { branchId } = useActiveBranchId(authProfile?.business_id ?? null);
  const { data: branches = [], isFetching: branchesFetching } = useBusinessBranches();
  const isEmployeeSession = Boolean(employeeSession?.session_token && !authProfile);
  const layoutRole = isEmployeeSession ? "employee" : "salon_admin";
  const employeeBranchId = employeeSession?.branch_id || null;
  const activeBranchId = useMemo(() => {
    if (employeeBranchId) return employeeBranchId;
    const validBranchId = branchId && branches.some((branch) => branch.id === branchId) ? branchId : null;
    return validBranchId || branches[0]?.id || null;
  }, [branchId, branches, employeeBranchId]);
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
  const [activeTab, setActiveTab] = useState<"catalogue" | "products" | "services">("products");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [productSetupOpen, setProductSetupOpen] = useState(false);
  const [productSetupItem, setProductSetupItem] = useState<CatalogItem | null>(null);
  const [productSetupPrice, setProductSetupPrice] = useState("0");
  const [productSetupStock, setProductSetupStock] = useState("0");
  const [productSetupSaving, setProductSetupSaving] = useState(false);

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
  const [pendingTabs, setPendingTabs] = useState<PendingTabSummary[]>([]);
  const [activePendingTab, setActivePendingTab] = useState<PendingTabDetail | null>(null);
  const [pendingTabDraftItems, setPendingTabDraftItems] = useState<CartItem[]>([]);
  const [pendingTabModalOpen, setPendingTabModalOpen] = useState(false);
  const [pendingTabLabel, setPendingTabLabel] = useState("");
  const [pendingTabClientQuery, setPendingTabClientQuery] = useState("");
  const [pendingTabClientResults, setPendingTabClientResults] = useState<PendingTabClientResult[]>([]);
  const [pendingTabSelectedClient, setPendingTabSelectedClient] = useState<PendingTabClientResult | null>(null);
  const [pendingTabClientLoading, setPendingTabClientLoading] = useState(false);
  const [pendingTabSaving, setPendingTabSaving] = useState(false);
  const [pendingTabLoading, setPendingTabLoading] = useState(false);

  useEffect(() => {
    if (normalizeEmployeeRole(employeeSession?.role) === "cashier") {
      setActiveTab("catalogue");
    }
  }, [employeeSession?.role]);

  const applyEmployeeBundle = (bundle: EmployeePosBundleResponse) => {
    setProducts((bundle.products || []).map((x) => ({
      id: x.id,
      name: x.name,
      unit_price: Number(x.unit_price || 0),
      category: x.category || undefined,
      stock: Number(x.quantity_in_stock || 0),
      barcode: x.barcode || undefined,
      type: "product" as const,
    })));
    setServices((bundle.services || []).map((x) => ({
      id: x.id,
      name: x.name,
      unit_price: Number(x.price_htg || 0),
      category: x.category_id || undefined,
      type: "service" as const,
    })));
    setPromotions((bundle.promotions || []) as Promotion[]);
    setEmployees((bundle.employees || []).map((row) => ({
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Employé",
      role: row.role || "cashier",
    })));
    setBusinessInfo({
      name: bundle.business?.name || bundle.branch?.name || "Mon Salon",
      address: bundle.branch?.address || "",
      phone: bundle.branch?.phone || "",
      logo_url: bundle.business?.logo_url || undefined,
    });
  };

  const loadData = async (branchIdToUse: string | null = activeBranchId) => {
    try {
      if (!branchIdToUse) {
        setProducts([]);
        setServices([]);
        setPromotions([]);
        return;
      }

      if (isEmployeeSession && employeeSession?.session_token) {
        const { data, error } = await supabase.rpc("get_employee_pos_bundle", {
          p_session_token: employeeSession.session_token,
          p_branch_id: branchIdToUse,
        });
        if (error) throw error;
        applyEmployeeBundle(data as EmployeePosBundleResponse);
        return;
      }

      let productsQuery = supabase.from("salon_products").select("id, name, unit_price, category, quantity_in_stock, barcode").eq("is_active", true);
      let servicesQuery = supabase.from("salon_services").select("id, name, price_htg, category_id, metadata").eq("is_active", true);
      const todayKey = getDateKeyInTimeZone(new Date(), DEFAULT_PLATFORM_TIME_ZONE);
      let promotionsQuery = supabase.from("salon_promotions").select("*").eq("is_active", true).lte("valid_from", todayKey).gte("valid_until", todayKey);

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
      if (isEmployeeSession) {
        return;
      }

      if (!activeBranchId) {
        setEmployees([]);
        return;
      }
      const { data: emp } = await supabase
        .from("salon_employees")
        .select("id, first_name, last_name, role")
        .eq("is_active", true)
        .eq("branch_id", activeBranchId)
        .order("first_name");
      if (emp) {
        setEmployees((emp || []).map((row: any) => ({
          id: row.id,
          name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
          role: row.role || "cashier",
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
        .eq("branch_id", activeBranchId)
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
    if (isEmployeeSession) {
      return;
    }
    if (!user && !employeeBranchId) return;
    try {
      const { data: prof } = user
        ? await supabase.from("profiles").select("business_id").eq("id", user.id).maybeSingle()
        : { data: null };
      const businessId = prof?.business_id || null;
      const sourceBranchId = businessId || employeeBranchId;

      if (sourceBranchId) {
        let resolvedBusinessId = businessId;

        if (!resolvedBusinessId && employeeBranchId) {
          const { data: branchRow } = await supabase.from("salon_branches").select("business_id").eq("id", employeeBranchId).maybeSingle();
          resolvedBusinessId = branchRow?.business_id || null;
        }

        if (resolvedBusinessId) {
          const { data: biz } = await supabase.from("businesses").select("id, name, logo_url").eq("id", resolvedBusinessId).maybeSingle();
          const { data: ext } = await supabase.from("salon_business_profiles").select("email, phone, address, whatsapp, slogan, tax_number").eq("business_id", resolvedBusinessId).maybeSingle();
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
      }
    } catch {}
  };

  useEffect(() => {
    void loadData(activeBranchId);
    void loadEmployees();
    void loadBusinessInfo();
    void loadPendingTabs();
    // reset client search if branch changes
      setSelectedClient(null);
      setClientQuery("");
      setActivePendingTab(null);
      setCart([]);
      setPendingTabDraftItems([]);
    setPendingTabs([]);
  }, [user, activeBranchId]);

  const loadPendingTabs = async () => {
    if (!activeBranchId) {
      setPendingTabs([]);
      return;
    }
    try {
      const tabs = await listPendingTabs(activeBranchId, "open");
      setPendingTabs(tabs as PendingTabSummary[]);
    } catch (error) {
      console.warn("Impossible de charger les fiches en attente", error);
      setPendingTabs([]);
    }
  };

  const loadPendingTabDetail = async (tabId: string) => {
    setPendingTabLoading(true);
    try {
      const tab = await getPendingTab(tabId);
      setActivePendingTab(tab as PendingTabDetail);
      const mappedItems = (tab?.items || []).map((item: any) => mapPendingItemToCart(item));
      setCart(mappedItems);
      setPendingTabDraftItems(mappedItems);
      setDiscountPercent(0);
      setPaymentMethod("cash");
      setPaymentSplits(EMPTY_PAYMENT_SPLITS);
      setSelectedEmployee("");
      if (tab?.client_id) {
        const clientName = tab.label || tab.guest_name || "Client";
        setPendingTabSelectedClient({
          id: tab.client_id,
          name: clientName,
          phone: "",
          visit_count: 0,
        });
        setSelectedClient({
          id: tab.client_id,
          name: clientName,
          phone: "",
          visit_count: 0,
        });
      } else {
        setPendingTabSelectedClient(null);
        setSelectedClient(null);
      }
      setPendingTabModalOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Impossible de charger la fiche");
    } finally {
      setPendingTabLoading(false);
    }
  };

  const leavePendingTabMode = () => {
    setActivePendingTab(null);
    setPendingTabDraftItems([]);
    setCart([]);
    setPendingTabSelectedClient(null);
    setPendingTabClientQuery("");
    setPendingTabClientResults([]);
    setSelectedClient(null);
    setDiscountPercent(0);
    setPaymentMethod("cash");
    setPaymentSplits(EMPTY_PAYMENT_SPLITS);
    setSelectedEmployee("");
  };

  const searchPendingTabClients = async (q: string) => {
    if (q.length < 2) {
      setPendingTabClientResults([]);
      return;
    }
    setPendingTabClientLoading(true);
    try {
      const results = await findPendingTabClientOptions(q, activeBranchId);
      setPendingTabClientResults(results);
    } catch {
      setPendingTabClientResults([]);
    } finally {
      setPendingTabClientLoading(false);
    }
  };

  const handlePendingTabClientQueryChange = (value: string) => {
    setPendingTabClientQuery(value);
    window.clearTimeout((handlePendingTabClientQueryChange as any).timer);
    (handlePendingTabClientQueryChange as any).timer = window.setTimeout(() => {
      void searchPendingTabClients(value);
    }, 250);
  };

  const savePendingTabDraft = async () => {
    if (!activePendingTab) return;
    setPendingTabSaving(true);
    try {
      for (const item of pendingTabDraftItems) {
        if (item.pending_item_id) {
          await deletePendingTabItem(activePendingTab.id, item.pending_item_id);
        }
      }

      for (const item of cart) {
        await addPendingTabItem(activePendingTab.id, {
          item_type: item.type,
          item_id: item.item_id,
          item_name: item.name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          added_by: employeeSession?.id || null,
        });
      }

      const refreshed = await getPendingTab(activePendingTab.id);
      setActivePendingTab(refreshed as PendingTabDetail);
      const mappedItems = (refreshed?.items || []).map((item: any) => mapPendingItemToCart(item));
      setCart(mappedItems);
      setPendingTabDraftItems(mappedItems);
      await loadPendingTabs();
      toast.success("Fiche mise à jour");
    } catch (error: any) {
      toast.error(error?.message || "Impossible de mettre à jour la fiche");
    } finally {
      setPendingTabSaving(false);
    }
  };

  const createPendingTabHandler = async () => {
    if (!activeBranchId) {
      toast.error("Sélectionnez une branche");
      return;
    }
    if (!pendingTabLabel.trim()) {
      toast.error("Le label de la fiche est requis");
      return;
    }

    setPendingTabSaving(true);
    try {
      const tab = await createPendingTab({
        label: pendingTabLabel.trim(),
        branch_id: activeBranchId,
        cashier_id: employeeSession?.id || null,
        client_id: pendingTabSelectedClient?.id || null,
        guest_name: pendingTabSelectedClient ? pendingTabSelectedClient.name : null,
      });

      await loadPendingTabs();
      setPendingTabModalOpen(false);
      setPendingTabLabel("");
      setPendingTabClientQuery("");
      setPendingTabClientResults([]);
      setPendingTabSelectedClient(null);
      toast.success(`Fiche ${tab.tab_number} ouverte`);
      await loadPendingTabDetail(tab.id);
    } catch (error: any) {
      toast.error(error?.message || "Impossible d'ouvrir la fiche");
    } finally {
      setPendingTabSaving(false);
    }
  };

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
    if (type === "product") {
      const hasValidPrice = Number(item.unit_price || 0) > 0;
      const hasValidStock = Number(item.stock || 0) > 0;

      if (!hasValidPrice || !hasValidStock) {
        setProductSetupItem(item);
        setProductSetupPrice(hasValidPrice ? String(item.unit_price) : "0");
        setProductSetupStock(hasValidStock ? String(item.stock) : "1");
        setProductSetupOpen(true);
        return;
      }
    }

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
    setCart((prev) => {
      if (activePendingTab) {
        const optionsSuffix = customOptions?.optionsText ? ` (${customOptions.optionsText})` : "";
        const itemName = `${item.name}${optionsSuffix}`;
        const unitPrice = item.unit_price + (customOptions?.extraCost || 0);
        const existingIndex = prev.findIndex(
          (cartItem) =>
            cartItem.type === type &&
            cartItem.item_id === item.id &&
            cartItem.name === itemName &&
            cartItem.unit_price === unitPrice
        );

        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + 1,
          };
          return next;
        }

        return [...prev, {
          key: `${type}-${item.id}-${Date.now()}`,
          type,
          item_id: item.id,
          name: itemName,
          quantity: 1,
          unit_price: unitPrice,
          category: item.category,
          promotion_applied: false,
          promotion_name: undefined,
          discount: 0,
          pending_item_id: null,
        }];
      }

      return addItemToCart(prev, item, type, promotions, customOptions);
    });
  };

  const saveProductSetupAndContinue = async () => {
    if (!productSetupItem || !activeBranchId) return;

    const nextPrice = Number(productSetupPrice || 0);
    const nextStock = Number(productSetupStock || 0);

    if (nextPrice <= 0) {
      toast.error("Définissez un prix de vente valide.");
      return;
    }
    if (nextStock <= 0) {
      toast.error("Définissez un stock supérieur à 0.");
      return;
    }

    setProductSetupSaving(true);
    try {
      const { error } = await supabase
        .from("salon_products")
        .update({
          unit_price: nextPrice,
          quantity_in_stock: nextStock,
        })
        .eq("id", productSetupItem.id)
        .eq("branch_id", activeBranchId);

      if (error) throw error;

      const refreshedItem: CatalogItem = {
        ...productSetupItem,
        unit_price: nextPrice,
        stock: nextStock,
      };

      await loadData(activeBranchId);
      setProductSetupOpen(false);
      setProductSetupItem(null);
      addToCart(refreshedItem, "product");
      toast.success("Prix et stock enregistrés, produit ajouté au panier.");
    } catch (error: any) {
      toast.error(error?.message || "Impossible d'enregistrer ce produit");
    } finally {
      setProductSetupSaving(false);
    }
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((prev) => {
      if (activePendingTab) {
        return prev
          .map((item) => {
            if (item.key !== key) return item;
            const quantity = Math.max(0, item.quantity + delta);
            return quantity === 0 ? null : { ...item, quantity };
          })
          .filter(Boolean) as CartItem[];
      }
      return updateCartQuantity(prev, key, delta, promotions);
    });
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => {
      if (activePendingTab) {
        return prev.filter((item) => item.key !== key);
      }
      return removeCartItem(prev, key, promotions);
    });
  };

  const hasServices = useMemo(() => cart.some(i => i.type === "service"), [cart]);
  const barberEmployees = useMemo(
    () => employees.filter((employee) => employee.role === "barber"),
    [employees]
  );

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
    const { data: employee } = await supabase
      .from("salon_employees")
      .select("role, commission_percentage")
      .eq("id", employeeId)
      .maybeSingle();

    if (employee?.role !== "barber") return null;

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

    if (employee?.commission_percentage) {
      return { type: "percentage", value: Number(employee.commission_percentage) };
    }

    return null;
  };

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Panier vide");
    if (hasServices && !selectedEmployee) {
      return toast.error("Veuillez sélectionner le barbier qui a réalisé la prestation.");
    }
    if (paymentMethod === "mixed" && !paymentValidation.isPaid) {
      return toast.error(`Paiement incomplet. Reste à payer: ${format(paymentValidation.remaining)}`);
    }

    try {
      const cashierName = employeeSession?.full_name || authProfile?.full_name || user?.email || "Caissier";
      const cashierId = employeeSession?.id || null;

      if (!activeBranchId) {
        throw new Error("Sélectionnez une branche avant d'encaisser");
      }

      if (activePendingTab) {
        await savePendingTabDraft();
        const checkoutResult = await checkoutPendingTab(activePendingTab.id, {
          payment_method: paymentMethod,
          amount_paid: paymentValidation.paid || total,
          cashier_id: cashierId,
          cashier_name: cashierName,
          employee_id: selectedEmployee || null,
          currency_code: currencyCode,
          payment_splits: resolvedPaymentSplits.map((split) => ({
            method: split.method,
            amount: split.amount,
          })),
        });

        toast.success("Fiche encaissée avec succès !");
        setLastSale({
          ...checkoutResult.sale,
          items: checkoutResult.items,
          customer: activePendingTab.label,
          payment: paymentMethod,
          cashier_name: cashierName,
          tab_number: activePendingTab.tab_number,
          label: activePendingTab.label,
          opened_at: activePendingTab.opened_at,
          closed_at: checkoutResult.sale.closed_at,
        });
        setShowReceipt(true);
        leavePendingTabMode();
        setDiscountPercent(0);
        setPaymentMethod("cash");
        setPaymentSplits(EMPTY_PAYMENT_SPLITS);
        await loadData(activeBranchId);
        await loadPendingTabs();
        return;
      }

      let businessId = authProfile?.business_id ?? null;
      if (!businessId && user?.id) {
        const { data: profileRow } = await supabase.from("profiles").select("business_id").eq("id", user.id).maybeSingle();
        businessId = profileRow?.business_id ?? null;
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
      setPaymentSplits(EMPTY_PAYMENT_SPLITS);
      await loadData(activeBranchId);
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Erreur lors de l'enregistrement");
    }
  };

  const handlePrintReceipt = async () => {
    if (!receiptRef.current) return;
    await printReceiptPdf(
      receiptRef.current,
      lastSale?.tab_number ? `fiche-${lastSale.tab_number}` : `recu-${lastSale?.sale_number || Date.now()}`
    );
    toast.success("Reçu PDF téléchargé !");
  };

  const currentItems = activeTab === "catalogue" ? [...products, ...services] : activeTab === "products" ? products : services;
  const filteredItems = currentItems.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.barcode || "").includes(searchTerm)
  );

  const hasActivePromotions = promotions.length > 0;
  const posTitle = isEmployeeSession ? "Caisse employé" : "POS / Caisse";
  const posSubtitle = isEmployeeSession
    ? "Vente rapide, produits et prestations de votre branche"
    : "Encaissement rapide avec promotions et commissions";

  if ((authProfile && branchesFetching) || (authProfile && !activeBranchId)) {
    return (
      <DashboardLayout role={layoutRole} title={posTitle} subtitle="Initialisation de la branche...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-xl w-full rounded-2xl border border-border bg-card/95 p-8 text-center shadow-elevated">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Le point de vente se prépare</h2>
            <p className="text-muted-foreground">
              Nous finalisons votre branche active. Dès qu’elle est prête, vous pourrez encaisser, créer des clients et utiliser vos produits et prestations sans sélection manuelle.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={layoutRole} title={posTitle} subtitle={posSubtitle}>
      <StaggerContainer className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
        <StaggerItem className="flex-1 flex flex-col min-w-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant={activeTab === "catalogue" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("catalogue")} className="gap-1">
                    <ShoppingCart className="h-4 w-4" /> Catalogue
                  </Button>
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
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Fiches en attente</h3>
                    <Badge variant="secondary">{pendingTabs.length} ouvertes</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      setPendingTabLabel("");
                      setPendingTabClientQuery("");
                      setPendingTabClientResults([]);
                      setPendingTabSelectedClient(null);
                      setPendingTabModalOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Nouvelle fiche
                  </Button>
                </div>
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-1">
                    {pendingTabs.map((tab: any) => {
                      const active = activePendingTab?.id === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => void loadPendingTabDetail(tab.id)}
                          className={cn(
                            "min-w-[180px] max-w-[240px] rounded-xl border p-3 text-left transition-all",
                            active
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{tab.label}</p>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {tab.tab_number}
                              </p>
                            </div>
                            <Badge variant={active ? "default" : "outline"} className="text-[10px] h-5">
                              {format(tab.total_amount)}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{tab.items_count} article{tab.items_count > 1 ? "s" : ""}</span>
                            <span>
                              {new Date(tab.opened_at).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: DEFAULT_PLATFORM_TIME_ZONE,
                              })}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {pendingTabs.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">
                        Aucune fiche ouverte aujourd'hui
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Le catalogue regroupe les produits définis par l’admin et les prestations/services actifs pour votre branche.
              </p>
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
                        <p className={cn(
                          "font-semibold mt-1 text-sm",
                          Number(item.unit_price || 0) > 0 ? "text-primary" : "text-destructive"
                        )}>
                          {Number(item.unit_price || 0) > 0 ? format(item.unit_price) : "Prix à définir"}
                        </p>
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
              {activePendingTab && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <div className="min-w-0">
                    <Badge variant="secondary" className="mb-1">Fiche ouverte</Badge>
                    <p className="text-sm font-semibold truncate">{activePendingTab.label}</p>
                    <p className="text-[10px] text-muted-foreground">{activePendingTab.tab_number}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={leavePendingTabMode} title="Retourner à la vente normale">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 pr-2 -mr-2">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      {activePendingTab ? "Ajoutez des articles à la fiche" : "Ajoutez des articles pour commencer"}
                    </p>
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

              {/* Barber Selector */}
              {hasServices && (
                <div className="mt-2">
                  <Label className="text-xs flex items-center gap-1 mb-1">
                    <UserCog className="h-3 w-3" /> Barbier en charge
                  </Label>
                  {barberEmployees.length > 0 ? (
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Sélectionner un barbier...</option>
                      {barberEmployees.map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      Aucun barbier actif n'a été trouvé pour cette branche.
                    </div>
                  )}
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

              {activePendingTab ? (
                <div className="mt-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="destructive" onClick={async () => {
                      if (!activePendingTab) return;
                      try {
                        await cancelPendingTab(activePendingTab.id);
                        toast.success("Fiche annulée");
                        leavePendingTabMode();
                        await loadData(activeBranchId);
                        await loadPendingTabs();
                      } catch (error: any) {
                        toast.error(error?.message || "Impossible d'annuler la fiche");
                      }
                    }} disabled={pendingTabSaving || pendingTabLoading}>
                      Annuler la fiche
                    </Button>
                    <Button onClick={async () => {
                      await savePendingTabDraft();
                      await loadData(activeBranchId);
                    }} disabled={cart.length === 0 || pendingTabSaving || pendingTabLoading} className="bg-primary h-11 text-base font-semibold">
                      Ajouter au tab
                    </Button>
                  </div>
                  <Button onClick={checkout} disabled={cart.length === 0 || pendingTabSaving || pendingTabLoading} className="w-full bg-primary h-11 text-base font-semibold">
                    Encaisser la fiche • {format(total)}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setCart([])} disabled={cart.length === 0}>
                    Annuler
                  </Button>
                  <Button onClick={checkout} disabled={cart.length === 0} className="bg-primary h-11 text-base font-semibold">
                    Encaisser • {format(total)}
                  </Button>
                </div>
              )}
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
              <span>{lastSale?.tab_number ? `Fiche #${lastSale.tab_number}` : `Reçu #${lastSale?.sale_number || ""}`}</span>
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
                label: lastSale?.label,
                tab_number: lastSale?.tab_number,
                opened_at: lastSale?.opened_at,
                closed_at: lastSale?.closed_at,
              }}
              items={lastSale?.items?.map((i: any) => ({
                item_name: i.name || i.item_name,
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

      <Dialog open={pendingTabModalOpen} onOpenChange={setPendingTabModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Nouvelle fiche</DialogTitle>
            <DialogDescription>
              Ouvrez une fiche en attente pour un client, une table ou un libellé libre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pending-tab-label">Nom / label *</Label>
              <Input
                id="pending-tab-label"
                placeholder="Ex : Jean, Table 3"
                value={pendingTabLabel}
                onChange={(e) => setPendingTabLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pending-tab-client">Client (optionnel)</Label>
              {pendingTabSelectedClient ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{pendingTabSelectedClient.name}</p>
                    {pendingTabSelectedClient.phone && (
                      <p className="text-xs text-muted-foreground">{pendingTabSelectedClient.phone}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setPendingTabSelectedClient(null);
                      setPendingTabClientQuery("");
                      setPendingTabClientResults([]);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="pending-tab-client"
                      className="pl-8"
                      placeholder="Rechercher un client..."
                      value={pendingTabClientQuery}
                      onChange={(e) => handlePendingTabClientQueryChange(e.target.value)}
                    />
                    {pendingTabClientLoading && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  {pendingTabClientQuery.length >= 2 && (
                    <div className="max-h-40 overflow-auto rounded-lg border border-border bg-background">
                      {pendingTabClientResults.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-muted-foreground text-center">Aucun client trouvé</p>
                      ) : (
                        pendingTabClientResults.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setPendingTabSelectedClient(client);
                              setPendingTabClientQuery(client.name);
                              setPendingTabClientResults([]);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{client.name}</p>
                              {client.phone && (
                                <p className="text-xs text-muted-foreground truncate">{client.phone}</p>
                              )}
                            </div>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {client.visit_count} visite{client.visit_count > 1 ? "s" : ""}
                            </Badge>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPendingTabModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={createPendingTabHandler} disabled={pendingTabSaving}>
              {pendingTabSaving ? "Ouverture..." : "Ouvrir la fiche"}
            </Button>
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

      <Dialog open={productSetupOpen} onOpenChange={setProductSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Définir le prix et le stock</DialogTitle>
            <DialogDescription>
              Ce produit n'a pas encore de prix ou de stock utilisable pour la vente. Définis-les avant de l'ajouter au panier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produit</Label>
              <Input value={productSetupItem?.name || ""} disabled />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-setup-price">Prix de vente</Label>
                <Input
                  id="product-setup-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productSetupPrice}
                  onChange={(e) => setProductSetupPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-setup-stock">Stock disponible</Label>
                <Input
                  id="product-setup-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={productSetupStock}
                  onChange={(e) => setProductSetupStock(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductSetupOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveProductSetupAndContinue} disabled={productSetupSaving}>
              {productSetupSaving ? "Enregistrement..." : "Enregistrer et ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
