import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { printReceipt as printReceiptPdf } from "@/lib/print-utils";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Minus, Trash2, Printer, Download, Search, Eye,
  Package, Scissors, CreditCard, Banknote, Wallet, User,
  Gift, Percent, Tag, Barcode, UserCog, X, Star, AlertCircle, ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveBranchId } from "@/lib/branch";
import { ReceiptTemplate, ReceiptData } from "@/components/printing/ReceiptTemplate";
import { printUnifiedReceipt } from "@/components/printing/receipt-engine";
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
  recordTabPayment,
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
  applyPromotions,
} from "@/modules/salon/pos";
import type { PaymentMethod } from "@/modules/salon/types";
import type { PaymentSplit } from "@/modules/salon/pos";
import { recordStockMovement } from "@/modules/salon/inventory";
import { processReturn, listSales as listSalonSales } from "@/services/return-service";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { DEFAULT_PLATFORM_TIME_ZONE, getDateKeyInTimeZone } from "@/lib/timezone-date";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { normalizeEmployeeRole } from "@/lib/employee-role";
import { fetchEmployeePosBundle, type EmployeePosBundle } from "@/modules/salon/auth";

interface CatalogItem {
  id: string;
  name: string;
  unit_price: number;
  category?: string;
  type: "product" | "service";
  stock?: number;
  barcode?: string;
  requires_employee?: boolean;
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
  requires_employee?: boolean;
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
  receipt_footer_message?: string;
  receipt_policy_message?: string;
  show_qr_code?: boolean;
  show_barcode?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  barber: "Barbier / Coiffeur",
  stylist: "Coiffeur(se)",
  nail_technician: "Technicien(ne) d'ongles",
  massage_therapist: "Massothérapeute",
  esthetician: "Esthéticien(ne)",
  makeup_artist: "Maquilleur(se)",
  receptionist: "Réceptionniste",
  cashier: "Caissier(ère)",
  manager: "Responsable",
};

interface EmployeeInfo {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  role: string;
  photo_url?: string;
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
  requires_employee: item.item_type === "service",
});

const describeRpcError = (err: unknown) => {
  if (!err || typeof err !== "object") return String(err || "Erreur inconnue");
  const typed = err as Record<string, any>;
  const parts = [
    typed.message,
    typed.details,
    typed.hint,
    typed.code ? `code=${typed.code}` : null,
    typed.status ? `status=${typed.status}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(typed);
};

export default function POSPage() {
  const { t } = useTranslation();
  const { user, profile: authProfile, employeeSession, logoutEmployee } = useAuth();
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
  const [serviceRoleRequirements, setServiceRoleRequirements] = useState<Record<string, string[]>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartStep, setCartStep] = useState<1 | 2>(1);
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
  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null);
  const [deleteAdminPin, setDeleteAdminPin] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const [amountTendered, setAmountTendered] = useState<number | "">("");
  const receiptRef = useRef<HTMLDivElement>(null);
  const [productSetupOpen, setProductSetupOpen] = useState(false);
  const [productSetupItem, setProductSetupItem] = useState<CatalogItem | null>(null);
  const [productSetupPrice, setProductSetupPrice] = useState("0");
  const [productSetupStock, setProductSetupStock] = useState("0");
  const [productSetupSaving, setProductSetupSaving] = useState(false);

  // Return / refund state
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnSaleSearch, setReturnSaleSearch] = useState("");
  const [returnFoundSale, setReturnFoundSale] = useState<any | null>(null);
  const [returnSearching, setReturnSearching] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  interface ReturnItemState { product_id: string; product_name: string; quantity: number; unit_price: number; max_quantity: number; item_id: string }
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnProcessing, setReturnProcessing] = useState(false);

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
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<"day" | "week" | "month">("day");
  const [pendingTabs, setPendingTabs] = useState<PendingTabSummary[]>([]);
  const [pendingTabSearch, setPendingTabSearch] = useState("");
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

  // ── Encaisser (payment-on-tab) dialog ──
  const [encaisserDialogOpen, setEncaisserDialogOpen] = useState(false);
  const [encaisserAmount, setEncaisserAmount] = useState<number | "">("");
  const [encaisserCreditConfirm, setEncaisserCreditConfirm] = useState(false);
  const [encaisserProcessing, setEncaisserProcessing] = useState(false);
  const [promptTabLabelOpen, setPromptTabLabelOpen] = useState(false);
  const [promptTabLabelName, setPromptTabLabelName] = useState("");

  useEffect(() => {
    if (normalizeEmployeeRole(employeeSession?.role) === "cashier") {
      setActiveTab("catalogue");
    }
  }, [employeeSession?.role]);

  useEffect(() => {
    if (activePendingTab) {
      setActiveTab("catalogue");
    }
  }, [activePendingTab?.id]);

  const applyEmployeeBundle = (bundle: EmployeePosBundle) => {
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
      requires_employee: x.requires_employee,
    })));
    setPromotions((bundle.promotions || []) as Promotion[]);
    setEmployees((bundle.employees || []).map((row) => ({
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Employé",
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      role: row.role || "cashier",
      photo_url: row.metadata?.photo_url || undefined,
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
        const data = await fetchEmployeePosBundle(employeeSession.session_token, branchIdToUse);
        applyEmployeeBundle(data);
        if ((data.products || []).length === 0 && (data.services || []).length === 0) {
          toast.warning("La session employé est valide, mais aucun produit ni service n'a été trouvé pour cette branche.");
        }
        const { data: roleReqs } = await supabase
          .from("service_role_requirements")
          .select("service_id, role");
        const roleReqsMap: Record<string, string[]> = {};
        for (const row of roleReqs || []) {
          const sid = row.service_id as string;
          const role = row.role as string;
          if (!roleReqsMap[sid]) roleReqsMap[sid] = [];
          if (!roleReqsMap[sid].includes(role)) roleReqsMap[sid].push(role);
        }
        setServiceRoleRequirements(roleReqsMap);
        return;
      }

      let productsQuery = supabase.from("salon_products").select("id, name, unit_price, category, quantity_in_stock, barcode").eq("is_active", true);
      let servicesQuery = supabase.from("salon_services").select("id, name, price_htg, category_id, requires_employee, metadata").eq("is_active", true);
      const todayKey = getDateKeyInTimeZone(new Date(), DEFAULT_PLATFORM_TIME_ZONE);
      let promotionsQuery = supabase.from("salon_promotions").select("*").eq("is_active", true).or(`valid_from.is.null,valid_from.lte.${todayKey}`).or(`valid_until.is.null,valid_until.gte.${todayKey}`);
      const roleReqQuery = supabase.from("service_role_requirements").select("service_id, role");

      productsQuery = productsQuery.eq("branch_id", branchIdToUse);
      servicesQuery = servicesQuery.eq("branch_id", branchIdToUse);
      promotionsQuery = promotionsQuery.eq("branch_id", branchIdToUse);

      const [{ data: p }, { data: s }, { data: promos }, { data: roleReqs }] = await Promise.all([
        productsQuery.order("name"),
        servicesQuery.order("name"),
        promotionsQuery,
        roleReqQuery,
      ]);
      setProducts((p || []).map(x => ({ ...x, unit_price: Number(x.unit_price || 0), stock: x.quantity_in_stock, type: "product" as const })));
      setServices((s || []).map(x => ({ ...x, unit_price: Number(x.price_htg || 0), type: "service" as const })));
      setPromotions((promos || []) as Promotion[]);

      const roleReqsMap: Record<string, string[]> = {};
      for (const row of roleReqs || []) {
        const sid = row.service_id as string;
        const role = row.role as string;
        if (!roleReqsMap[sid]) roleReqsMap[sid] = [];
        if (!roleReqsMap[sid].includes(role)) roleReqsMap[sid].push(role);
      }
      setServiceRoleRequirements(roleReqsMap);
    } catch (err) {
      const message = describeRpcError(err);
      console.error("Erreur chargement POS:", err);
      console.error("Erreur chargement POS (détaillée):", message);
      if (isEmployeeSession && /session employé invalide|expir/i.test(message)) {
        logoutEmployee();
        setProducts([]);
        setServices([]);
        setPromotions([]);
        setEmployees([]);
        return;
      }
      toast.error(message || "Impossible de charger le catalogue");
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
        .select("id, first_name, last_name, role, metadata")
        .eq("is_active", true)
        .eq("branch_id", activeBranchId)
        .order("first_name");
      if (emp) {
        setEmployees((emp || []).map((row: any) => ({
          id: row.id,
          name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
          first_name: row.first_name || "",
          last_name: row.last_name || "",
          role: row.role || "cashier",
          photo_url: row.metadata?.photo_url || undefined,
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
          const { data: biz } = await supabase.from("businesses").select("id, name, logo_url, receipt_footer_message, receipt_policy_message, show_qr_code, show_barcode").eq("id", resolvedBusinessId).maybeSingle();
          const { data: ext } = await supabase.from("salon_business_profiles").select("email, phone, address, whatsapp, slogan, tax_number").eq("business_id", resolvedBusinessId).maybeSingle();
          if (biz) {
            const info: BusinessInfo = {
              name: biz.name || "Mon Salon",
              address: ext?.address || "",
              phone: ext?.phone || "",
              logo_url: biz.logo_url,
              receipt_footer_message: biz.receipt_footer_message || undefined,
              receipt_policy_message: biz.receipt_policy_message || undefined,
              show_qr_code: biz.show_qr_code !== false,
              show_barcode: biz.show_barcode === true,
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
      setPendingTabs(Array.isArray(tabs) ? (tabs as PendingTabSummary[]) : []);
    } catch (error) {
      console.warn("Impossible de charger les fiches en attente", error);
      setPendingTabs([]);
    }
  };

  const loadSalesHistory = async () => {
    if (!activeBranchId) return;
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from("salon_sales")
        .select("*, items:salon_sale_items(*)")
        .eq("branch_id", activeBranchId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSalesHistory(data || []);
    } catch (err: any) {
      console.error("Error loading sales history:", err);
      toast.error("Impossible de charger l'historique des fiches");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      void loadSalesHistory();
    }
  }, [activeTab, activeBranchId]);

  const filteredSalesHistory = useMemo(() => {
    if (!searchTerm) return salesHistory;
    const query = searchTerm.toLowerCase();
    return salesHistory.filter((sale) => {
      const matchNumber = (sale.sale_number || "").toLowerCase().includes(query);
      const matchTab = (sale.tab_number || "").toString().includes(query);
      const matchClient = (sale.customer_name || sale.customer || "").toLowerCase().includes(query);
      return matchNumber || matchTab || matchClient;
    });
  }, [salesHistory, searchTerm]);

  const groupedSales = useMemo(() => {
    const groups: Record<string, any[]> = {};

    filteredSalesHistory.forEach((sale) => {
      const date = new Date(sale.created_at);
      let groupKey = "";

      if (historyPeriod === "day") {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
          groupKey = "Aujourd'hui";
        } else if (date.toDateString() === yesterday.toDateString()) {
          groupKey = "Hier";
        } else {
          groupKey = date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        }
      } else if (historyPeriod === "week") {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(date.setDate(diff));
        groupKey = `Semaine du ${startOfWeek.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
      } else {
        groupKey = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        groupKey = groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(sale);
    });

    return groups;
  }, [filteredSalesHistory, historyPeriod]);

  const filteredPendingTabs = useMemo(() => {
    if (!pendingTabSearch.trim()) return pendingTabs;
    const query = pendingTabSearch.toLowerCase();
    return pendingTabs.filter(tab => 
      (tab.label && tab.label.toLowerCase().includes(query)) ||
      (tab.tab_number && tab.tab_number.toLowerCase().includes(query)) ||
      (tab.guest_name && tab.guest_name.toLowerCase().includes(query))
    );
  }, [pendingTabs, pendingTabSearch]);

  const handleReprint = async (sale: any) => {
    const employeeObj = employees.find(e => e.id === sale.employee_id);
    const employeeName = employeeObj ? `${employeeObj.first_name} ${employeeObj.last_name}`.trim() : "";

    const data: ReceiptData = {
      business: {
        name: businessInfo?.name || "SALON / SPA",
        logo_url: businessInfo?.logo_url,
        address: businessInfo?.address,
        phone: businessInfo?.phone,
        email: businessInfo?.email,
        nif: businessInfo?.tax_number,
        receipt_footer_message: businessInfo?.receipt_footer_message,
        receipt_policy_message: businessInfo?.receipt_policy_message,
        show_qr_code: businessInfo?.show_qr_code !== false,
        show_barcode: businessInfo?.show_barcode === true,
      },
      transaction: {
        invoiceNumber: sale.tab_number ? `FICHE-${sale.tab_number}` : sale.sale_number,
        date: sale.closed_at || sale.created_at || new Date().toISOString(),
        cashierName: sale.cashier_name || "Caisse",
        clientName: sale.customer_name || sale.customer || "",
        cashRegister: "CAISSE SALON",
        barberName: employeeName || sale.barber_name || "",
      },
      items: sale.items?.map((i: any) => ({
        name: i.name || i.item_name || (products.find(p => p.id === i.product_id)?.name) || (services.find(s => s.id === i.service_id)?.name) || "Article",
        quantity: i.quantity,
        price: i.unit_price,
        total: i.total_price || ((i.quantity * i.unit_price) - (i.discount || 0))
      })) || [],
      totals: {
        subtotal: sale.total_amount + (sale.discount_amount || 0),
        discount: sale.discount_amount,
        total: sale.total_amount,
      },
      payment: {
        method: sale.payment_method === "cash" ? "ESPÈCES" :
                sale.payment_method === "card" ? "CARTE" :
                sale.payment_method === "moncash" ? "MONCASH" :
                sale.payment_method === "natcash" ? "NATCASH" : "AUTRE",
        amountReceived: sale.total_amount,
      },
      currencyCode: currencyCode,
    };
    printUnifiedReceipt(data, format);
    toast.success("Impression lancée !");
  };

  const handleViewReceipt = (sale: any) => {
    const employeeObj = employees.find(e => e.id === sale.employee_id);
    const employeeName = employeeObj ? `${employeeObj.first_name} ${employeeObj.last_name}`.trim() : "";

    setLastSale({
      ...sale,
      customer: sale.customer_name || sale.customer || "",
      barber_name: employeeName || sale.barber_name || "",
      items: sale.items?.map((i: any) => ({
        name: i.name || i.item_name || (products.find(p => p.id === i.product_id)?.name) || (services.find(s => s.id === i.service_id)?.name) || "Article",
        quantity: i.quantity,
        unit_price: i.unit_price,
      })) || [],
      discount_amount: sale.discount_amount || 0,
      payment: sale.payment_method || "cash",
    });
    setShowReceipt(true);
  };

  const handleDeleteSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteSaleId || !deleteAdminPin.trim()) {
      toast.error("Veuillez entrer le Code PIN Maître");
      return;
    }
    
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc("delete_salon_sale_with_pin", {
        p_sale_id: deleteSaleId,
        p_pin: deleteAdminPin.trim()
      });

      if (error) throw error;
      
      const res = data as { success: boolean; error?: string };
      if (!res.success) {
        toast.error(res.error || "Impossible de supprimer la fiche");
        return;
      }

      toast.success("Fiche supprimée avec succès");
      setDeleteSaleId(null);
      setDeleteAdminPin("");
      
      void loadSalesHistory();
    } catch (err: any) {
      console.error("Error deleting sale:", err);
      toast.error("Une erreur est survenue lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };


  const loadPendingTabDetail = async (tabId: string) => {
    setPendingTabLoading(true);
    try {
      const tab = await getPendingTab(tabId);
      setActivePendingTab(tab as PendingTabDetail);
      setActiveTab("catalogue");
      const mappedItems = (tab?.items || []).map((item: any) => mapPendingItemToCart(item));
      setCart(applyPromotions(mappedItems, promotions));
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
    setActiveTab("catalogue");
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
      setCart(applyPromotions(mappedItems, promotions));
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
      setActiveTab("catalogue");
      toast.success(`Fiche ${tab.tab_number} ouverte`);
      await loadPendingTabDetail(tab.id);
    } catch (error: any) {
      toast.error(error?.message || "Impossible d'ouvrir la fiche");
    } finally {
      setPendingTabSaving(false);
    }
  };

  const handleConfirmPartialSaleAsTab = async (clientName: string) => {
    setPromptTabLabelOpen(false);
    try {
      const cashierName = employeeSession?.full_name || authProfile?.full_name || user?.email || "Caissier";
      const cashierId = employeeSession?.id || null;

      // 1. Create a new pending tab
      const tab = await createPendingTab({
        label: clientName.trim(),
        branch_id: activeBranchId,
        cashier_id: cashierId,
        client_id: selectedClient?.id || null,
        guest_name: selectedClient ? selectedClient.name : clientName.trim(),
      });

      // 2. Add cart items to this new tab
      for (const item of cart) {
        await addPendingTabItem(tab.id, {
          item_type: item.type,
          item_id: item.item_id,
          item_name: item.name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          added_by: cashierId,
        });
      }

      // 3. Record the partial payment made
      const amountPaid = paymentMethod === "cash" && typeof amountTendered === "number" && amountTendered < total 
        ? amountTendered 
        : paymentMethod === "mixed" 
        ? paymentValidation.paid 
        : total;

      if (amountPaid > 0) {
        await recordTabPayment(tab.id, amountPaid);
      }

      // 4. Save and trigger receipt display
      const extBarberObj = employees.find(e => e.id === selectedEmployee);
      const extBarberName = extBarberObj ? `${extBarberObj.first_name} ${extBarberObj.last_name}`.trim() : "";

      setLastSale({
        id: `partial-${Date.now()}`,
        sale_number: null,
        total_amount: total,
        discount_amount: totalDiscount,
        items: cart.map(i => ({
          name: i.name,
          item_name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.discount || 0,
        })),
        customer: clientName.trim(),
        payment: paymentMethod,
        cashier_name: cashierName,
        tab_number: tab.tab_number,
        label: tab.label,
        opened_at: tab.opened_at,
        closed_at: null,
        _encaisser: true,
        _amountPaid: amountPaid,
        _changeGiven: 0,
        _balanceRemaining: total - amountPaid,
        barber_name: extBarberName,
      });

      setShowReceipt(true);
      setCart([]);
      setCartStep(1);
      setSelectedClient(null);
      setClientQuery("");
      setDiscountPercent(0);
      setPaymentMethod("cash");
      setPaymentSplits(EMPTY_PAYMENT_SPLITS);

      await loadData(activeBranchId);
      await loadPendingTabs();
      toast.success("Fiche en attente créée pour le montant restant !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création de la fiche");
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
        } else if (applicablePromo.promotion_type === "bundle" && applicablePromo.discount_value && applicablePromo.minimum_quantity) {
          const bundleCount = Math.floor(item.quantity / applicablePromo.minimum_quantity);
          const totalNormalPriceForBundles = item.unit_price * applicablePromo.minimum_quantity * bundleCount;
          const totalBundlePrice = applicablePromo.discount_value * bundleCount;
          discount = totalNormalPriceForBundles - totalBundlePrice;
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
          return applyPromotions(next, promotions);
        }

        return applyPromotions([...prev, {
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
          requires_employee: type === "service",
        }], promotions);
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
        const next = prev
          .map((item) => {
            if (item.key !== key) return item;
            const quantity = Math.max(0, item.quantity + delta);
            return quantity === 0 ? null : { ...item, quantity };
          })
          .filter(Boolean) as CartItem[];
        return applyPromotions(next, promotions);
      }
      return updateCartQuantity(prev, key, delta, promotions);
    });
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => {
      if (activePendingTab) {
        return applyPromotions(prev.filter((item) => item.key !== key), promotions);
      }
      return removeCartItem(prev, key, promotions);
    });
  };

  const requiresEmployee = useMemo(() => cart.some(i => i.type === "service" && i.requires_employee !== false), [cart]);
  const cartServiceIds = useMemo(() => cart.filter(i => i.type === "service").map(i => i.item_id), [cart]);
  const allowedRoles = useMemo(() => {
    const roles = new Set<string>();
    for (const sid of cartServiceIds) {
      const svcRoles = serviceRoleRequirements[sid];
      if (svcRoles && svcRoles.length > 0) {
        for (const r of svcRoles) roles.add(r);
      }
    }
    if (roles.size === 0 && cartServiceIds.length > 0) return null;
    return roles.size > 0 ? roles : null;
  }, [cartServiceIds, serviceRoleRequirements]);
  const availableEmployees = useMemo(() => {
    if (!allowedRoles) return employees;
    return employees.filter(e => allowedRoles.has(e.role));
  }, [employees, allowedRoles]);

  const totals = useMemo(() => calculateCartTotals(cart, discountPercent), [cart, discountPercent]);
  const { subtotal, totalDiscount, total } = totals;
  const paidOnTab = activePendingTab ? Number((activePendingTab as any).total_paid || 0) : 0;
  const remainingBalance = activePendingTab && paidOnTab > 0 ? Math.max(0, total - paidOnTab) : total;
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

    if (!employee) return null;

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

  const handleOpenEncaisser = async () => {
    if (!activePendingTab) return;
    if (cart.length === 0) return;
    setEncaisserProcessing(true);
    try {
      await savePendingTabDraft();
      await loadPendingTabs();
      setEncaisserAmount("");
      setEncaisserCreditConfirm(false);
      setEncaisserDialogOpen(true);
    } finally {
      setEncaisserProcessing(false);
    }
  };

  const handleConfirmEncaisser = async () => {
    if (!activePendingTab || encaisserAmount === "" || typeof encaisserAmount !== "number") return;
    if (encaisserAmount <= 0) {
      toast.error("Veuillez entrer un montant valide");
      return;
    }
    if (encaisserAmount < remainingBalance && !encaisserCreditConfirm) {
      setEncaisserCreditConfirm(true);
      return;
    }

    const cashierName = employeeSession?.full_name || authProfile?.full_name || user?.email || "Caissier";
    const isFullPayment = encaisserAmount >= remainingBalance;
    const paidAmount = isFullPayment ? remainingBalance : encaisserAmount;
    const cashierId = employeeSession?.id || null;

    if (isFullPayment) {
      try {
        const checkoutResult = await checkoutPendingTab(activePendingTab.id, {
          payment_method: "cash",
          amount_paid: paidAmount,
          total_amount: total,
          discount_amount: totalDiscount,
          cashier_id: cashierId,
          cashier_name: cashierName,
          employee_id: selectedEmployee || activePendingTab.employee_id || null,
          currency_code: currencyCode,
        });

        toast.success("Fiche encaissée et clôturée avec succès !");
        const pendingBarberObj = employees.find(e => e.id === (selectedEmployee || checkoutResult.sale?.employee_id));
        const pendingBarberName = pendingBarberObj ? `${pendingBarberObj.first_name} ${pendingBarberObj.last_name}`.trim() : "";
        setLastSale({
          ...checkoutResult.sale,
          total_amount: total,
          discount_amount: totalDiscount,
          items: checkoutResult.items,
          customer: activePendingTab.label,
          payment: "cash",
          tab_number: activePendingTab.tab_number,
          label: activePendingTab.label,
          opened_at: activePendingTab.opened_at,
          closed_at: checkoutResult.sale.closed_at,
          barber_name: pendingBarberName,
        });
        setShowReceipt(true);
        leavePendingTabMode();
        setCartStep(1);
        setDiscountPercent(0);
        setPaymentMethod("cash");
        setPaymentSplits(EMPTY_PAYMENT_SPLITS);
        setEncaisserDialogOpen(false);
        setEncaisserAmount("");
        setEncaisserCreditConfirm(false);
        await loadData(activeBranchId);
        await loadPendingTabs();
        return;
      } catch (err: any) {
        console.error("Encaisser checkout error:", err);
        toast.error(err.message || "Erreur lors de la clôture de la fiche");
        return;
      }
    }

    const encaisserItems = pendingTabDraftItems.map(i => ({
      name: i.name,
      item_name: i.name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount || 0,
    }));

    // Record payment in local storage (tracks remaining balance on tab)
    try {
      await recordTabPayment(activePendingTab.id, paidAmount);
    } catch (err: any) {
      console.warn("Paiement non enregistré localement:", err?.message);
    }

    // Try to record the payment in Supabase (non-fatal — RLS may block employee sessions)
    let businessId = authProfile?.business_id ?? null;
    if (!businessId && user?.id) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user.id)
        .maybeSingle();
      businessId = profileRow?.business_id ?? null;
    }
    if (businessId && activeBranchId) {
      try {
        const { data: sale } = await supabase
          .from("salon_sales")
          .insert({
            business_id: businessId,
            branch_id: activeBranchId,
            customer_name: activePendingTab.label,
            payment_method: "cash",
            total_amount: paidAmount,
            discount_amount: 0,
            tax_amount: 0,
            cashier_name: cashierName,
          })
          .select("id")
          .single();
        if (sale?.id) {
          await supabase.from("salon_sale_payments").insert({
            sale_id: sale.id,
            business_id: businessId,
            branch_id: activeBranchId,
            payment_method: "cash",
            amount: paidAmount,
            currency_code: "HTG",
          });
        }
      } catch (err: any) {
        console.warn("Paiement partiel non enregistré en base:", err?.message);
      }
    }

    setAmountTendered(encaisserAmount);
    setLastSale({
      id: `encaisser-${Date.now()}`,
      sale_number: null,
      total_amount: total,
      discount_amount: totalDiscount,
      items: encaisserItems,
      customer: activePendingTab.label,
      payment: "cash",
      cashier_name: cashierName,
      tab_number: activePendingTab.tab_number,
      label: activePendingTab.label,
      opened_at: activePendingTab.opened_at,
      closed_at: new Date().toISOString(),
      _encaisser: true,
      _amountPaid: paidAmount,
      _changeGiven: isFullPayment ? encaisserAmount - remainingBalance : 0,
      _balanceRemaining: isFullPayment ? 0 : remainingBalance - paidAmount,
    });
    setShowReceipt(true);
    setEncaisserDialogOpen(false);
    setEncaisserAmount("");
    setEncaisserCreditConfirm(false);

    // Reload tabs so remaining balance updates on the tab card
    await loadPendingTabs();
  };

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Panier vide");
    if (requiresEmployee && !selectedEmployee) {
      return toast.error("Veuillez sélectionner l'employé ayant réalisé la prestation.");
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
          total_amount: total,
          discount_amount: totalDiscount,
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
        const pendingBarberObj = employees.find(e => e.id === (selectedEmployee || checkoutResult.sale?.employee_id));
        const pendingBarberName = pendingBarberObj ? `${pendingBarberObj.first_name} ${pendingBarberObj.last_name}`.trim() : "";
        setLastSale({
          ...checkoutResult.sale,
          total_amount: total,
          discount_amount: totalDiscount,
          items: checkoutResult.items,
          customer: activePendingTab.label,
          payment: paymentMethod,
          cashier_name: cashierName,
          tab_number: activePendingTab.tab_number,
          label: activePendingTab.label,
          opened_at: activePendingTab.opened_at,
          closed_at: checkoutResult.sale.closed_at,
          barber_name: pendingBarberName,
        });
        setShowReceipt(true);
        leavePendingTabMode();
        setCartStep(1);
        setDiscountPercent(0);
        setPaymentMethod("cash");
        setPaymentSplits(EMPTY_PAYMENT_SPLITS);
        await loadData(activeBranchId);
        await loadPendingTabs();
        return;
      }

      const amountPaid = paymentMethod === "cash" && typeof amountTendered === "number" && amountTendered < total 
        ? amountTendered 
        : paymentMethod === "mixed" 
        ? paymentValidation.paid 
        : total;
      const remaining = total - amountPaid;

      if (remaining > 0) {
        if (!selectedClient) {
          setPromptTabLabelName("");
          setPromptTabLabelOpen(true);
          return;
        } else {
          await handleConfirmPartialSaleAsTab(selectedClient.name);
          return;
        }
      }

      let businessId = authProfile?.business_id ?? null;
      if (!businessId && user?.id) {
        const { data: profileRow } = await supabase.from("profiles").select("business_id").eq("id", user.id).maybeSingle();
        businessId = profileRow?.business_id ?? null;
      }

      const { data: sale, error: saleError } = await supabase
        .from("salon_sales")
        .insert([{
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
        product_id: i.type === "product" ? i.item_id : null,
        service_id: i.type === "service" ? i.item_id : null,
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
      if (selectedEmployee) {
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
      const directBarberObj = employees.find(e => e.id === selectedEmployee);
      const directBarberName = directBarberObj ? `${directBarberObj.first_name} ${directBarberObj.last_name}`.trim() : "";

      setLastSale({
        ...sale,
        total_amount: total,
        discount_amount: totalDiscount,
        items: cart,
        customer: selectedClient?.name || "",
        payment: paymentMethod,
        cashier_name: cashierName,
        barber_name: directBarberName,
      });
      setShowReceipt(true);
      setCart([]);
      setCartStep(1);
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
    if (!lastSale || !receiptRef.current) return;
    const data: ReceiptData = {
      business: {
        name: businessInfo?.name || "SALON / SPA",
        logo_url: businessInfo?.logo_url,
        address: businessInfo?.address,
        phone: businessInfo?.phone,
        email: businessInfo?.email,
        nif: businessInfo?.tax_number,
        receipt_footer_message: businessInfo?.receipt_footer_message,
        receipt_policy_message: businessInfo?.receipt_policy_message,
        show_qr_code: businessInfo?.show_qr_code !== false,
        show_barcode: businessInfo?.show_barcode === true,
      },
      transaction: {
        invoiceNumber: lastSale.tab_number ? `FICHE-${lastSale.tab_number}` : lastSale.sale_number,
        date: lastSale.closed_at || lastSale.created_at || new Date().toISOString(),
        cashierName: lastSale.cashier_name || employeeSession?.full_name || "Caisse",
        clientName: lastSale.customer || "",
        cashRegister: "CAISSE SALON",
        barberName: lastSale.barber_name,
      },
      items: lastSale.items?.map((i: any) => ({
        name: i.name || i.item_name,
        quantity: i.quantity,
        price: i.unit_price,
        total: (i.quantity * i.unit_price) - (i.discount || 0)
      })) || [],
      totals: {
        subtotal: lastSale.total_amount + (lastSale.discount_amount || 0),
        discount: lastSale.discount_amount,
        total: lastSale.total_amount,
      },
      payment: lastSale._encaisser ? {
        method: "ESPÈCES",
        amountReceived: lastSale._amountPaid,
        amountTendered: lastSale._changeGiven > 0 ? lastSale._amountPaid + lastSale._changeGiven : lastSale._amountPaid,
        changeGiven: lastSale._changeGiven > 0 ? lastSale._changeGiven : undefined,
        balanceRemaining: lastSale._balanceRemaining > 0 ? lastSale._balanceRemaining : undefined,
      } : {
        method: lastSale.payment === "cash" ? "ESPÈCES" :
                lastSale.payment === "card" ? "CARTE" :
                lastSale.payment === "moncash" ? "MONCASH" :
                lastSale.payment === "natcash" ? "NATCASH" : "AUTRE",
        amountReceived: lastSale.total_amount,
        amountTendered: typeof amountTendered === "number" && amountTendered >= lastSale.total_amount ? amountTendered : undefined,
        changeGiven: typeof amountTendered === "number" && amountTendered >= lastSale.total_amount ? amountTendered - lastSale.total_amount : undefined,
      },
      currencyCode: currencyCode,
    };
    printUnifiedReceipt(data, format);
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
      <SubscriptionGuard>
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
                  <Button variant={activeTab === "history" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("history")} className="gap-1">
                    <Printer className="h-4 w-4" /> Historique fiches
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Fiches en attente</h3>
                    <Badge variant="secondary">{pendingTabs.length} ouvertes</Badge>
                  </div>
                  
                  {/* Zone de recherche centrée au milieu */}
                  <div className="relative flex-1 max-w-md mx-auto w-full sm:w-auto">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher une fiche..."
                      value={pendingTabSearch}
                      onChange={e => setPendingTabSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-background w-full"
                    />
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-8 text-xs shrink-0 self-end sm:self-auto"
                    onClick={() => {
                      setPendingTabLabel("");
                      setPendingTabClientQuery("");
                      setPendingTabClientResults([]);
                      setPendingTabSelectedClient(null);
                      setPendingTabModalOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Nouvelle fiche
                  </Button>
                </div>

                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-3">
                    {filteredPendingTabs.map((tab: any) => {
                      const active = activePendingTab?.id === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => void loadPendingTabDetail(tab.id)}
                          className={cn(
                            "min-w-[180px] max-w-[240px] rounded-xl border p-3 text-left transition-all shrink-0",
                            active
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{tab.label}</p>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {tab.tab_number}
                              </p>
                            </div>
                            <Badge variant={active ? "default" : "outline"} className={cn("text-[10px] h-5 shrink-0", (tab as any).total_paid > 0 && "text-amber-600 border-amber-400")}>
                              {(tab as any).total_paid > 0
                                ? `Solde: ${format(tab.total_amount - (tab as any).total_paid)}`
                                : format(tab.total_amount)}
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
                    {filteredPendingTabs.length === 0 && (
                      <div className="w-full rounded-xl border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground text-center">
                        {pendingTabSearch ? "Aucun résultat trouvé pour votre recherche" : "Aucune fiche ouverte aujourd'hui"}
                      </div>
                    )}
                  </div>
                  <ScrollBar orientation="horizontal" className="h-2" />
                </ScrollArea>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Le catalogue regroupe les produits et les prestations définis par l’admin et actifs pour votre branche.
              </p>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                {activeTab === "history" ? (
                  <div className="space-y-4">
                    <div className="flex gap-2 p-1 bg-muted/60 rounded-lg w-fit">
                      <Button
                        size="sm"
                        variant={historyPeriod === "day" ? "default" : "ghost"}
                        className="h-8 text-xs"
                        onClick={() => setHistoryPeriod("day")}
                      >
                        Jour
                      </Button>
                      <Button
                        size="sm"
                        variant={historyPeriod === "week" ? "default" : "ghost"}
                        className="h-8 text-xs"
                        onClick={() => setHistoryPeriod("week")}
                      >
                        Semaine
                      </Button>
                      <Button
                        size="sm"
                        variant={historyPeriod === "month" ? "default" : "ghost"}
                        className="h-8 text-xs"
                        onClick={() => setHistoryPeriod("month")}
                      >
                        Mois
                      </Button>
                    </div>

                    {loadingHistory ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : Object.keys(groupedSales).length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">
                        Aucune fiche imprimée trouvée
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(groupedSales).map(([groupName, sales]) => (
                          <div key={groupName} className="space-y-3">
                            <h4 className="font-semibold text-sm border-b pb-1.5 text-muted-foreground tracking-wide uppercase">
                              {groupName} ({sales.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {sales.map((sale: any) => {
                                const cashierName = sale.cashier_name || "Caissier";
                                const dateObj = new Date(sale.created_at);
                                const dateStr = dateObj.toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });
                                const employeeObj = employees.find(e => e.id === sale.employee_id);
                                const barberName = employeeObj 
                                  ? `${employeeObj.first_name} ${employeeObj.last_name}`.trim() 
                                  : sale.barber_name;

                                return (
                                  <Card key={sale.id} className="border border-border/80 hover:border-primary/40 transition-all shadow-sm">
                                    <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <p className="font-bold text-sm text-foreground">
                                            {sale.tab_number ? `Fiche #${sale.tab_number}` : `Reçu #${sale.sale_number}`}
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            Enregistré à {dateStr} par {cashierName}
                                          </p>
                                        </div>
                                        <Badge className="font-semibold">
                                          {format(sale.total_amount)}
                                        </Badge>
                                      </div>

                                      <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-2 rounded-lg">
                                        <div>
                                          <span className="font-medium text-foreground">Client : </span>
                                          {sale.customer_name || sale.customer || "Anonyme"}
                                        </div>
                                        {barberName && (
                                          <div>
                                            <span className="font-medium text-foreground">Barbier : </span>
                                            {barberName}
                                          </div>
                                        )}
                                        <div className="truncate">
                                          <span className="font-medium text-foreground">Articles : </span>
                                          {sale.items?.map((it: any) => it.name || it.item_name || "Article").join(", ") || "-"}
                                        </div>
                                      </div>

                                      <div className="flex justify-end gap-2 pt-1 border-t">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 text-xs gap-1.5"
                                          onClick={() => handleViewReceipt(sale)}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                          Visualiser
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 text-xs gap-1.5"
                                          onClick={() => void handleReprint(sale)}
                                        >
                                          <Printer className="h-3.5 w-3.5" />
                                          Réimprimer
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="h-8 text-xs gap-1.5 ml-2"
                                          onClick={() => setDeleteSaleId(sale.id)}
                                        >
                                          Supprimer
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredItems.map((item: any) => (
                      <Card key={item.id} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-soft active:scale-[0.98]"
                        onClick={() => handleItemClick(item, item.type)}>
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
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem className="w-full lg:w-96 flex flex-col min-h-0">
          <Card className="h-full flex flex-col min-h-0">
            <CardHeader className="pb-3 shrink-0">
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
            <CardContent className="flex-1 flex flex-col overflow-hidden min-h-0">
              {cartStep === 1 ? (
                <>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ScrollArea className="h-full pr-1.5">
                      {cart.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">
                            {activePendingTab ? "Ajoutez des articles à la fiche" : "Ajoutez des articles pour commencer"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {cart.map(item => (
                            <div key={item.key} className={cn(
                              "flex flex-col gap-2 p-3 rounded-lg border transition-all hover:border-primary/30",
                              item.promotion_applied ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-muted/40 border-border/80"
                            )}>
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span className="text-xs text-muted-foreground">{format(item.unit_price)} l'unité</span>
                                    {item.promotion_applied && (
                                      <Badge variant="secondary" className="text-[9px] px-1.5 h-4.5 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                                        <Tag className="h-2.5 w-2.5 mr-0.5" /> Promo
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => removeFromCart(item.key)} title="Supprimer">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/40">
                                <div className="flex items-center gap-1">
                                  <Button variant="outline" size="icon" className="h-7 w-7 bg-background" onClick={() => updateQuantity(item.key, -1)}>
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center text-sm font-semibold text-foreground">{item.quantity}</span>
                                  <Button variant="outline" size="icon" className="h-7 w-7 bg-background" onClick={() => updateQuantity(item.key, 1)}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-sm text-primary">
                                    {format(item.unit_price * item.quantity)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <div className="shrink-0 space-y-3 pt-3 border-t">
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span className="text-base text-foreground font-bold">{format(subtotal)}</span>
                    </div>
                    <Button 
                      className="w-full bg-primary h-11 text-base font-semibold"
                      disabled={cart.length === 0} 
                      onClick={() => setCartStep(2)}
                    >
                      Continuer
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setCartStep(1)} className="h-8 gap-1.5">
                      <X className="h-3.5 w-3.5 rotate-180" />
                      Retour
                    </Button>
                    <span className="text-xs font-semibold text-muted-foreground">Étape 2: Validation</span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ScrollArea className="h-full pr-1.5">
                      <div className="space-y-4 pb-4">
                        {/* Résumé des produits */}
                      <div className="space-y-1 bg-muted/40 p-3 rounded-lg border border-border/80">
                        <div className="flex justify-between items-center text-xs font-bold text-muted-foreground pb-1.5 border-b uppercase tracking-wider">
                          <span>Articles ({cart.length})</span>
                          <span>{t("pos.total")}</span>
                        </div>
                        <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1 mt-2">
                          {cart.map(item => (
                            <div key={item.key} className="flex justify-between items-center text-xs">
                              <span className="truncate max-w-[160px] text-foreground font-medium">{item.name} <span className="text-muted-foreground">x{item.quantity}</span></span>
                              <span className="font-semibold text-foreground">{format(item.unit_price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Employee Selector */}
                      {requiresEmployee && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold flex items-center gap-1">
                            <UserCog className="h-3.5 w-3.5 text-primary" /> Employé en charge
                          </Label>
                          {availableEmployees.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {availableEmployees.map((employee) => {
                                const isSelected = selectedEmployee === employee.id;
                                const roleLabel = ROLE_LABELS[employee.role] || employee.role;
                                return (
                                  <button
                                    key={employee.id}
                                    type="button"
                                    onClick={() => setSelectedEmployee(isSelected ? "" : employee.id)}
                                    className={cn(
                                      "flex items-center gap-2 rounded-lg border p-2 text-left transition-all",
                                      isSelected
                                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                                    )}
                                  >
                                    <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden">
                                      {employee.photo_url ? (
                                        <img src={employee.photo_url} alt="" className="h-full w-full object-cover" />
                                      ) : (
                                        employee.name.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold truncate text-foreground">{employee.name}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{roleLabel}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                              Aucun employé disponible.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Client Selector */}
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1 text-xs font-semibold">
                          <User className="h-3.5 w-3.5 text-primary" /> Client <span className="text-muted-foreground font-normal">(optionnel)</span>
                        </Label>

                        {selectedClient ? (
                          <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                              {selectedClient.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium truncate text-foreground">{selectedClient.name}</span>
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
                                  className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                                          <span className="text-sm font-medium truncate text-foreground">{c.name}</span>
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

                  {/* Réduction */}
                  <div className="space-y-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 -ml-2" onClick={() => setShowDiscount(!showDiscount)}>
                      <Percent className="h-3 w-3" /> Réduction
                    </Button>
                    {showDiscount && (
                      <div className="flex items-center gap-2">
                        <Input type="number" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} min={0} max={100} className="w-20 h-8 text-xs" />
                        <span className="text-sm">%</span>
                      </div>
                    )}
                  </div>

                  {/* Moyen de paiement */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Moyen de paiement</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                    >
                      <SelectTrigger className="w-full h-9 text-xs bg-background">
                        <SelectValue placeholder="Sélectionnez un mode de paiement" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Espèces</SelectItem>
                        <SelectItem value="moncash">MonCash</SelectItem>
                        <SelectItem value="natcash">NatCash</SelectItem>
                        <SelectItem value="card">Carte</SelectItem>
                        <SelectItem value="mixed">Mixte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                    {paymentMethod === "mixed" && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {paymentSplits.map((split) => (
                            <div key={split.method} className="space-y-1">
                              <Label className="text-[11px]">
                                <span>{split.method === "cash" ? "Espèces" : split.method}</span>
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
                        <div className="flex justify-between text-xs pt-1.5 border-t border-border/40">
                          <span className="text-muted-foreground">Payé: {format(paymentValidation.paid)}</span>
                          <span className={paymentValidation.isPaid ? "text-success font-semibold" : "text-destructive font-semibold"}>
                            Reste: {format(paymentValidation.remaining)}
                          </span>
                        </div>
                      </div>
                    )}

                  {/* Montant donné + Monnaie rendue (cash seulement) */}
                  {paymentMethod === "cash" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Montant donné par le client</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">G</span>
                        <Input
                          type="number"
                          min={total}
                          step="any"
                          placeholder={`Min ${format(total)}`}
                          className="pl-8 h-9 text-xs"
                          value={amountTendered}
                          onChange={(e) => setAmountTendered(e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                      {typeof amountTendered === "number" && amountTendered >= total && (
                        <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                          <span className="text-xs font-semibold text-green-700 dark:text-green-400">💵 Monnaie à rendre</span>
                          <span className="text-base font-bold text-green-700 dark:text-green-400">{format(amountTendered - total)}</span>
                        </div>
                      )}
                      {typeof amountTendered === "number" && amountTendered > 0 && amountTendered < total && (
                        <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                          <span className="text-xs font-semibold text-orange-600">⚠️ Paiement partiel (Crédit)</span>
                          <span className="text-xs font-bold text-orange-600">{format(total - amountTendered)} restant</span>
                        </div>
                      )}
                    </div>
                  )}
                      </div>
                    </ScrollArea>
              </div>

              <div className="shrink-0 space-y-3 pt-3 border-t">
                {/* Total summary */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span className="text-foreground">{format(subtotal)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Réduction</span>
                      <span>-{format(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-border/40 text-foreground">
                    <span>{t("pos.total")}</span>
                    <span className="text-primary text-base font-bold">{format(total)}</span>
                  </div>
                  {paidOnTab > 0 && (
                    <>
                      <div className="flex justify-between text-success text-[11px]">
                        <span>Déjà payé</span>
                        <span>-{format(paidOnTab)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-border/60 text-amber-600">
                        <span>{t("common.balance")}</span>
                        <span>{format(remainingBalance)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Checkout CTA Buttons */}
                {activePendingTab ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="destructive" size="sm" onClick={async () => {
                        if (!activePendingTab) return;
                        try {
                          await cancelPendingTab(activePendingTab.id);
                          toast.success("Fiche annulée");
                          leavePendingTabMode();
                          setCartStep(1);
                          await loadData(activeBranchId);
                          await loadPendingTabs();
                        } catch (error: any) {
                          toast.error(error?.message || "Impossible d'annuler la fiche");
                        }
                      }} disabled={pendingTabSaving || pendingTabLoading || paidOnTab > 0}>
                        Annuler la fiche
                      </Button>
                      <Button size="sm" onClick={async () => {
                        await savePendingTabDraft();
                        await loadData(activeBranchId);
                        setCartStep(1);
                      }} disabled={cart.length === 0 || pendingTabSaving || pendingTabLoading} className="bg-primary">
                        Ajouter au tab
                      </Button>
                    </div>
                    {paidOnTab > 0 && (
                      <p className="text-[9px] text-destructive text-center">
                        Paiement enregistré: annulation impossible
                      </p>
                    )}
                    <Button onClick={handleOpenEncaisser} disabled={cart.length === 0 || pendingTabSaving || pendingTabLoading || encaisserProcessing} className="w-full bg-primary h-10 font-semibold">
                      Encaisser la fiche • {paidOnTab > 0 ? format(remainingBalance) : format(total)}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setCart([]); setCartStep(1); }} disabled={cart.length === 0}>
                        Vider
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)} className="gap-1">
                        Retour
                      </Button>
                      <Button onClick={checkout} disabled={cart.length === 0} className="bg-primary font-semibold text-xs col-span-1">{t("pos.pay")}</Button>
                    </div>
                  </div>
                )}
              </div>
            </>
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
            <Button variant="outline" onClick={() => setOptionsModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={confirmServiceOptions}>Ajouter au panier</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal : Encaisser la fiche (paiement sur fiche) ────────────── */}
      <Dialog open={encaisserDialogOpen} onOpenChange={(open) => {
        if (!open) { setEncaisserCreditConfirm(false); setEncaisserAmount(""); }
        setEncaisserDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Encaisser la fiche</DialogTitle>
            <DialogDescription>
              {activePendingTab?.label} — {activePendingTab?.tab_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-between items-center rounded-lg border bg-muted/30 px-4 py-3">
              <span className="text-sm font-medium">{paidOnTab > 0 ? "Reste à payer" : "Total fiche"}</span>
              <span className="text-xl font-bold text-primary">{format(paidOnTab > 0 ? remainingBalance : total)}</span>
            </div>
            {paidOnTab > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Total initial</span>
                <span>{format(total)}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Montant donné par le client</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">G</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder={`Ex: ${format(paidOnTab > 0 ? remainingBalance : total)}`}
                  className="pl-8"
                  value={encaisserAmount}
                  onChange={(e) => {
                    setEncaisserAmount(e.target.value === "" ? "" : Number(e.target.value));
                    setEncaisserCreditConfirm(false);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleConfirmEncaisser(); }}
                />
              </div>
            </div>
            {typeof encaisserAmount === "number" && encaisserAmount >= remainingBalance && (
              <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">Monnaie à rendre</span>
                <span className="text-xl font-bold text-green-700 dark:text-green-400">{format(encaisserAmount - remainingBalance)}</span>
              </div>
            )}
            {typeof encaisserAmount === "number" && encaisserAmount > 0 && encaisserAmount < remainingBalance && !encaisserCreditConfirm && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-3">
                  <span className="text-sm font-semibold text-orange-600">Paiement partiel</span>
                  <span className="text-sm font-bold text-orange-600">{format(remainingBalance - encaisserAmount)} restant</span>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
                  <p className="font-medium mb-1">Accorder un crédit à ce client ?</p>
                  <p className="text-muted-foreground text-xs">Le solde restant sera dû par le client. La fiche reste en attente.</p>
                </div>
              </div>
            )}
            {typeof encaisserAmount === "number" && encaisserAmount > 0 && encaisserAmount < remainingBalance && encaisserCreditConfirm && (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
                <span className="text-sm font-semibold text-blue-600">Crédit confirmé</span>
                <span className="text-sm font-bold text-blue-600">Payé: {format(encaisserAmount)}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setEncaisserDialogOpen(false);
              setEncaisserCreditConfirm(false);
              setEncaisserAmount("");
            }}>
              Annuler
            </Button>
            {typeof encaisserAmount === "number" && encaisserAmount > 0 && encaisserAmount < remainingBalance && !encaisserCreditConfirm ? (
              <>
                <Button variant="destructive" onClick={() => {
                  setEncaisserCreditConfirm(false);
                  setEncaisserAmount("");
                  setEncaisserDialogOpen(false);
                }}>
                  Non
                </Button>
                <Button onClick={() => setEncaisserCreditConfirm(true)}>
                  Oui, créditer
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConfirmEncaisser}
                disabled={encaisserAmount === "" || typeof encaisserAmount !== "number" || encaisserAmount <= 0}
              >
                Confirmer
              </Button>
            )}
          </DialogFooter>
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

            <div className="bg-gray-100 p-2 rounded flex justify-center max-h-[60vh] overflow-y-auto">
              <ReceiptTemplate
                ref={receiptRef}
                formatAmount={format}
                data={{
                  business: {
                    name: businessInfo?.name || "SALON / SPA",
                    logo_url: businessInfo?.logo_url,
                    address: businessInfo?.address,
                    phone: businessInfo?.phone,
                    email: businessInfo?.email,
                    nif: businessInfo?.tax_number,
                    receipt_footer_message: businessInfo?.receipt_footer_message,
                    receipt_policy_message: businessInfo?.receipt_policy_message,
                    show_qr_code: businessInfo?.show_qr_code !== false,
                    show_barcode: businessInfo?.show_barcode === true,
                  },
                  transaction: {
                    invoiceNumber: lastSale?.tab_number ? `FICHE-${lastSale.tab_number}` : lastSale?.sale_number,
                    date: lastSale?.closed_at || lastSale?.created_at || new Date().toISOString(),
                    cashierName: lastSale?.cashier_name || employeeSession?.full_name || "Caisse",
                    clientName: lastSale?.customer || "",
                    cashRegister: "CAISSE SALON",
                    barberName: lastSale?.barber_name,
                  },
                  items: lastSale?.items?.map((i: any) => ({
                    name: i.name || i.item_name,
                    quantity: i.quantity,
                    price: i.unit_price,
                    total: (i.quantity * i.unit_price) - (i.discount || 0)
                  })) || [],
                  totals: {
                    subtotal: (lastSale?.total_amount || 0) + (lastSale?.discount_amount || 0),
                    discount: lastSale?.discount_amount,
                    total: lastSale?.total_amount || 0,
                  },
                  payment: lastSale?._encaisser ? {
                    method: "ESPÈCES",
                    amountReceived: lastSale._amountPaid,
                    amountTendered: lastSale._changeGiven > 0 ? lastSale._amountPaid + lastSale._changeGiven : lastSale._amountPaid,
                    changeGiven: lastSale._changeGiven > 0 ? lastSale._changeGiven : undefined,
                    balanceRemaining: lastSale._balanceRemaining > 0 ? lastSale._balanceRemaining : undefined,
                  } : {
                    method: lastSale?.payment === "cash" ? "ESPÈCES" :
                            lastSale?.payment === "card" ? "CARTE" :
                            lastSale?.payment === "moncash" ? "MONCASH" :
                            lastSale?.payment === "natcash" ? "NATCASH" : "AUTRE",
                    amountReceived: lastSale?.total_amount || 0,
                    amountTendered: typeof amountTendered === "number" && amountTendered >= (lastSale?.total_amount || 0) ? amountTendered : undefined,
                    changeGiven: typeof amountTendered === "number" && amountTendered >= (lastSale?.total_amount || 0) ? amountTendered - (lastSale?.total_amount || 0) : undefined,
                  },
                  currencyCode: currencyCode,
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowReceipt(false)}>{t("common.close")}</Button>
              <Button onClick={handlePrintReceipt}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
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
                autoComplete="off"
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
                      autoComplete="off"
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
            <Button variant="outline" onClick={() => setShowNewClientModal(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveNewClient} disabled={newClientSaving}>
              {newClientSaving ? "Enregistrement..." : "Créer et sélectionner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal : Retour / Remboursement ──────────────────────────── */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Retour produit</DialogTitle>
            <DialogDescription>
              Recherchez une vente par son numéro pour retourner des articles.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro de vente..."
                  value={returnSaleSearch}
                  onChange={(e) => setReturnSaleSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !returnSearching) {
                      setReturnSearching(true);
                      setReturnFoundSale(null);
                      (async () => {
                        try {
                          if (!activeBranchId) { toast.error("Aucune branche sélectionnée"); return; }
                          const businessId = authProfile?.business_id ?? null;
                          if (!businessId) { toast.error("Aucune entreprise trouvée"); return; }
                          const sales = await listSalonSales("salon", businessId);
                          const found = sales.find(
                            (s: any) => s.sale_number?.toLowerCase() === returnSaleSearch.trim().toLowerCase()
                          );
                          if (!found) {
                            toast.error("Vente introuvable");
                            return;
                          }
                          setReturnFoundSale(found);
                          if (found.refund_status === "full") {
                            toast.warning("Cette vente a déjà été entièrement retournée");
                          }
                          setReturnItems(
                            (found.items || []).map((item: any) => ({
                              product_id: item.product_id ?? "",
                              product_name: item.product_name || item.name || "Article",
                              quantity: 0,
                              unit_price: Number(item.unit_price || 0),
                              max_quantity: Number(item.quantity || 0) - Number(item.returned_quantity || 0),
                              item_id: item.id ?? "",
                            })).filter((i: ReturnItemState) => i.max_quantity > 0)
                          );
                        } catch (e: any) { toast.error(e.message); }
                        finally { setReturnSearching(false); }
                      })();
                    }
                  }}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={() => {
                  setReturnSearching(true);
                  setReturnFoundSale(null);
                  (async () => {
                    try {
                      if (!activeBranchId) { toast.error("Aucune branche sélectionnée"); return; }
                      const businessId = authProfile?.business_id ?? null;
                      if (!businessId) { toast.error("Aucune entreprise trouvée"); return; }
                      const sales = await listSalonSales("salon", businessId);
                      const found = sales.find(
                        (s: any) => s.sale_number?.toLowerCase() === returnSaleSearch.trim().toLowerCase()
                      );
                      if (!found) { toast.error("Vente introuvable"); return; }
                      setReturnFoundSale(found);
                      if (found.refund_status === "full") {
                        toast.warning("Cette vente a déjà été entièrement retournée");
                      }
                      setReturnItems(
                        (found.items || []).map((item: any) => ({
                          product_id: item.product_id ?? "",
                          product_name: item.product_name || item.name || "Article",
                          quantity: 0,
                          unit_price: Number(item.unit_price || 0),
                          max_quantity: Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0)),
                          item_id: item.id ?? "",
                        })).filter((i: ReturnItemState) => i.max_quantity > 0)
                      );
                    } catch (e: any) { toast.error(e.message); }
                    finally { setReturnSearching(false); }
                  })();
                }}
                disabled={returnSearching}
              >
                {returnSearching ? "..." : "Chercher"}
              </Button>
            </div>

            {returnFoundSale && (
              <>
                <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold">{returnFoundSale.sale_number}</span>
                      {returnFoundSale.customer_name && (
                        <span className="text-muted-foreground ml-4">Client: {returnFoundSale.customer_name}</span>
                      )}
                    </div>
                    <Badge variant={returnFoundSale.refund_status === "full" ? "destructive" : returnFoundSale.refund_status === "partial" ? "secondary" : "outline"}>
                      {returnFoundSale.refund_status === "full" ? "Retourné" : returnFoundSale.refund_status === "partial" ? "Partiel" : "Aucun retour"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total: {format(returnFoundSale.total_amount)} | {new Date(returnFoundSale.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>

                <div>
                  <Label>Articles à retourner</Label>
                  <div className="border rounded-md mt-1">
                    {returnItems.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Tous les articles ont déjà été retournés
                      </div>
                    ) : (
                      returnItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/20">
                          <input
                            type="checkbox"
                            checked={item.quantity > 0}
                            onChange={() => {
                              setReturnItems((prev) =>
                                prev.map((i, n) =>
                                  n === idx ? { ...i, quantity: i.quantity > 0 ? 0 : i.max_quantity } : i
                                )
                              );
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">{format(item.unit_price)}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Max: {item.max_quantity}
                          </span>
                          <Input
                            type="number"
                            min="0"
                            max={item.max_quantity}
                            value={item.quantity}
                            onChange={(e) => {
                              const qty = Math.min(Math.max(0, Number(e.target.value)), item.max_quantity);
                              setReturnItems((prev) =>
                                prev.map((i, n) => (n === idx ? { ...i, quantity: qty } : i))
                              );
                            }}
                            className="w-20 h-8 text-center"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <Label>Motif du retour (optionnel)</Label>
                  <Textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Raison du retour..."
                    rows={2}
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span>Articles sélectionnés: {returnItems.filter(i => i.quantity > 0).length}</span>
                    <span>Quantité totale: {returnItems.reduce((s, i) => s + i.quantity, 0)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setReturnOpen(false); setReturnFoundSale(null); setReturnItems([]); setReturnReason(""); }}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                const items = returnItems.filter((i) => i.quantity > 0);
                if (items.length === 0) { toast.error("Sélectionnez au moins un article"); return; }
                if (!activeBranchId) { toast.error("Aucune branche"); return; }
                const businessId = authProfile?.business_id ?? null;
                if (!businessId) { toast.error("Aucune entreprise"); return; }
                setReturnProcessing(true);
                try {
                  const result = await processReturn("salon", {
                    business_id: businessId,
                    branch_id: activeBranchId,
                    sale_id: returnFoundSale.id,
                    items: items.map((i) => ({
                      product_id: i.product_id,
                      product_name: i.product_name,
                      quantity: i.quantity,
                      unit_price: i.unit_price,
                    })),
                    reason: returnReason || undefined,
                    cashier_id: employeeSession?.id ?? null,
                  });
                  if (!result.success) {
                    toast.error(result.error || "Erreur lors du retour");
                  } else {
                    toast.success(`Retour ${result.refund_status === "full" ? "total" : "partiel"} enregistré`);
                    setReturnOpen(false);
                    setReturnFoundSale(null);
                    setReturnItems([]);
                    setReturnReason("");
                    await loadData(activeBranchId);
                  }
                } catch (e: any) { toast.error(e.message); }
                finally { setReturnProcessing(false); }
              }}
              disabled={!returnFoundSale || returnProcessing || returnItems.filter(i => i.quantity > 0).length === 0}
            >
              {returnProcessing ? "Traitement..." : "Valider le retour"}
            </Button>
          </DialogFooter>
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
              <Label>{t("common.product")}</Label>
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

      <Dialog open={promptTabLabelOpen} onOpenChange={setPromptTabLabelOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Nom de la fiche en attente</DialogTitle>
            <DialogDescription>
              Un montant restant doit être réglé plus tard. Saisissez le nom de la personne pour enregistrer cette fiche en attente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-tab-name">Nom du client</Label>
              <Input
                id="prompt-tab-name"
                value={promptTabLabelName}
                onChange={(e) => setPromptTabLabelName(e.target.value)}
                placeholder="Ex: Client en attente"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptTabLabelOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => void handleConfirmPartialSaleAsTab(promptTabLabelName)} disabled={!promptTabLabelName.trim()}>
              Créer la fiche en attente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Sale Dialog */}
      <Dialog open={!!deleteSaleId} onOpenChange={(open) => !open && setDeleteSaleId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              Supprimer cette fiche ?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            <p>Cette action est irréversible. Les statistiques du client seront annulées et les articles seront remis en stock.</p>
            <p className="mt-2 font-medium text-foreground">Veuillez entrer le Code PIN Maître pour confirmer :</p>
          </div>
          <form onSubmit={handleDeleteSale} className="space-y-4">
            <Input
              type="password"
              placeholder="Code PIN"
              value={deleteAdminPin}
              onChange={(e) => setDeleteAdminPin(e.target.value)}
              autoFocus
              className="text-center text-lg tracking-[0.3em] font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDeleteSaleId(null)}>
                Annuler
              </Button>
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                {isDeleting ? "Suppression..." : "Confirmer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      </SubscriptionGuard>
    </DashboardLayout>
  );
}
