import { supabase } from "@/lib/supabase";
import { recordStockMovement } from "@/modules/salon/inventory";
import type {
  PendingTabCheckoutInput,
  PendingTabCreateInput,
  PendingTabDetail,
  PendingTabItemInput,
  PendingTabSummary,
} from "./types";

const apiBase = "/api/pending-tabs";
const LOCAL_STORAGE_KEY = "wesd_pending_tabs_local";

type LocalPendingTabsState = {
  tabs: PendingTabDetail[];
};

const isBrowser = typeof window !== "undefined";

const readLocalState = (): LocalPendingTabsState => {
  if (!isBrowser) return { tabs: [] };
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { tabs: [] };
    const parsed = JSON.parse(raw) as LocalPendingTabsState;
    return { tabs: Array.isArray(parsed.tabs) ? parsed.tabs : [] };
  } catch {
    return { tabs: [] };
  }
};

const writeLocalState = (state: LocalPendingTabsState) => {
  if (!isBrowser) return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
};

const startOfTodayIso = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
};

const endOfToday = () => {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
};

const toNumber = (value: unknown) => Number(value || 0);

const groupTabItems = (items: PendingTabDetail["items"]) => {
  const grouped = new Map<string, PendingTabDetail["items"][number] & { source_ids: string[] }>();

  for (const item of items) {
    const key = `${item.item_type}:${item.item_id}:${item.item_name}:${Number(item.unit_price || 0)}`;
    const current = grouped.get(key) || {
      ...item,
      quantity: 0,
      subtotal: 0,
      source_ids: [],
    };

    current.quantity += Number(item.quantity || 0);
    current.subtotal += Number(item.subtotal || 0);
    current.source_ids.push(item.id);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map(({ source_ids, ...item }) => item);
};

const getBusinessIdForBranch = async (branchId: string) => {
  const { data, error } = await supabase
    .from("salon_branches")
    .select("id, business_id")
    .eq("id", branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.business_id) throw new Error("Business introuvable pour cette branche");
  return String(data.business_id);
};

const getCommissionRate = async (employeeId: string, serviceId: string): Promise<{ type: string; value: number } | null> => {
  const { data: employee, error: employeeError } = await supabase
    .from("salon_employees")
    .select("role, commission_percentage")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) throw new Error(employeeError.message);
  if (employee?.role !== "barber") return null;

  const { data: rules, error: ruleError } = await supabase
    .from("commission_rules")
    .select("rate_type, rate_value")
    .eq("employee_id", employeeId)
    .eq("service_id", serviceId)
    .eq("is_active", true)
    .maybeSingle();

  if (ruleError) throw new Error(ruleError.message);
  if (rules) return { type: rules.rate_type, value: Number(rules.rate_value) };

  const { data: global, error: globalError } = await supabase
    .from("commission_rules")
    .select("rate_type, rate_value")
    .eq("employee_id", employeeId)
    .is("service_id", null)
    .eq("is_active", true)
    .maybeSingle();

  if (globalError) throw new Error(globalError.message);
  if (global) return { type: global.rate_type, value: Number(global.rate_value) };

  if (employee?.commission_percentage) {
    return { type: "percentage", value: Number(employee.commission_percentage) };
  }

  return null;
};

const adjustLocalProductStock = async (
  tab: PendingTabDetail,
  productId: string,
  quantityDelta: number,
  reason: string,
  referenceId: string,
  createdBy: string | null = null
) => {
  const businessId = await getBusinessIdForBranch(tab.branch_id);
  const { data: product, error: productError } = await supabase
    .from("salon_products")
    .select("id, quantity_in_stock, unit_cost_price")
    .eq("id", productId)
    .maybeSingle();

  if (productError) throw new Error(productError.message);

  const previousStock = Number(product?.quantity_in_stock || 0);
  const nextStock = previousStock + Number(quantityDelta || 0);
  if (nextStock < 0) throw new Error("Stock insuffisant pour cette fiche");

  const { error: updateError } = await supabase
    .from("salon_products")
    .update({ quantity_in_stock: nextStock })
    .eq("id", productId);
  if (updateError) throw new Error(updateError.message);

  await recordStockMovement({
    business_id: businessId,
    branch_id: tab.branch_id,
    product_id: productId,
    movement_type: quantityDelta < 0 ? "sale" : "adjustment",
    quantity_delta: quantityDelta,
    quantity_before: previousStock,
    quantity_after: nextStock,
    unit_cost: product?.unit_cost_price ?? null,
    reason,
    reference_type: "pending_tab",
    reference_id: referenceId,
    created_by: createdBy,
  });
};

const restoreLocalPendingTabStock = async (tab: PendingTabDetail) => {
  for (const item of tab.items) {
    if (item.item_type !== "product") continue;
    await adjustLocalProductStock(
      tab,
      item.item_id,
      Number(item.quantity || 0),
      `Annulation fiche #${tab.tab_number}`,
      tab.id
    );
  }
};

const makeTabNumber = (branchId: string, tabs: PendingTabDetail[]) => {
  const prefix = branchId.slice(0, 3).toUpperCase() || "TAB";
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const sameDay = tabs.filter((tab) => tab.branch_id === branchId && tab.opened_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const next = String(sameDay.length + 1).padStart(3, "0");
  return `${prefix}-${today}-${next}`;
};

const mapLocalSummary = (tab: PendingTabDetail): PendingTabSummary => ({
  id: tab.id,
  tab_number: tab.tab_number,
  label: tab.label,
  client_id: tab.client_id,
  guest_name: tab.guest_name,
  status: tab.status,
  branch_id: tab.branch_id,
  cashier_id: tab.cashier_id,
  opened_at: tab.opened_at,
  closed_at: tab.closed_at,
  notes: tab.notes,
  items_count: tab.items.reduce((sum, item) => sum + toNumber(item.quantity), 0),
  total_amount: tab.items.reduce((sum, item) => sum + toNumber(item.subtotal), 0),
});

const createLocalTab = (input: PendingTabCreateInput): PendingTabDetail => {
  const state = readLocalState();
  const now = new Date().toISOString();
  const tab: PendingTabDetail = {
    id: crypto.randomUUID(),
    tab_number: makeTabNumber(input.branch_id, state.tabs),
    label: input.label.trim(),
    client_id: input.client_id || null,
    guest_name: input.guest_name || null,
    status: "open",
    branch_id: input.branch_id,
    cashier_id: input.cashier_id || null,
    opened_at: now,
    closed_at: null,
    notes: input.notes || null,
    items: [],
    items_count: 0,
    total_amount: 0,
  };
  state.tabs.unshift(tab);
  writeLocalState(state);
  return tab;
};

const updateLocalTab = (tab: PendingTabDetail) => {
  const state = readLocalState();
  const index = state.tabs.findIndex((entry) => entry.id === tab.id);
  if (index >= 0) {
    state.tabs[index] = tab;
    writeLocalState(state);
  }
  return tab;
};

const deleteLocalItem = (tab: PendingTabDetail, itemId: string) => {
  const items = tab.items.filter((item) => item.id !== itemId);
  return {
    ...tab,
    items,
    items_count: items.reduce((sum, item) => sum + toNumber(item.quantity), 0),
    total_amount: items.reduce((sum, item) => sum + toNumber(item.subtotal), 0),
  };
};

const addLocalItem = (tab: PendingTabDetail, input: PendingTabItemInput) => {
  const quantity = Math.max(1, Number(input.quantity || 1));
  const unitPrice = Number(input.unit_price || 0);
  const item = {
    id: crypto.randomUUID(),
    tab_id: tab.id,
    item_type: input.item_type,
    item_id: input.item_id,
    item_name: input.item_name,
    unit_price: unitPrice,
    quantity,
    subtotal: unitPrice * quantity,
    added_at: new Date().toISOString(),
    added_by: input.added_by || null,
  };

  const items = [...tab.items, item];
  return {
    ...tab,
    items,
    items_count: items.reduce((sum, entry) => sum + toNumber(entry.quantity), 0),
    total_amount: items.reduce((sum, entry) => sum + toNumber(entry.subtotal), 0),
  };
};

const checkoutLocalTab = (tab: PendingTabDetail, input: PendingTabCheckoutInput) => {
  const now = new Date().toISOString();
  const saleItems = groupTabItems(tab.items);

  return (async () => {
    const businessId = await getBusinessIdForBranch(tab.branch_id);
    const totalAmount = saleItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);

    const { data: sale, error: saleError } = await supabase
      .from("salon_sales")
      .insert({
        business_id: businessId,
        branch_id: tab.branch_id,
        customer_name: tab.label,
        customer_id: tab.client_id || null,
        payment_method: input.payment_method === "mixed" ? "cash" : input.payment_method,
        total_amount: totalAmount,
        discount_amount: 0,
        discount_percentage: 0,
        tax_amount: 0,
        employee_id: input.employee_id || null,
        cashier_name: input.cashier_name || null,
        cashier_id: input.cashier_id || tab.cashier_id || null,
      })
      .select("id, sale_number, created_at")
      .single();

    if (saleError || !sale?.id) throw new Error(saleError?.message || "Impossible de créer la transaction");

    const { error: saleItemError } = await supabase.from("salon_sale_items").insert(
      saleItems.map((item) => ({
        sale_id: sale.id,
        branch_id: tab.branch_id,
        ...(item.item_type === "product" ? { product_id: item.item_id } : {}),
        ...(item.item_type === "service" ? { service_id: item.item_id } : {}),
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.subtotal,
      }))
    );
    if (saleItemError) throw new Error(saleItemError.message);

    if (Array.isArray(input.payment_splits) && input.payment_splits.length > 0) {
      const { error: paymentError } = await supabase.from("salon_sale_payments").insert(
        input.payment_splits.map((split) => ({
          sale_id: sale.id,
          business_id: businessId,
          branch_id: tab.branch_id,
          payment_method: split.method || input.payment_method,
          amount: Number(split.amount || 0),
          currency_code: input.currency_code || "HTG",
        }))
      );
      if (paymentError) throw new Error(paymentError.message);
    } else {
      const { error: paymentError } = await supabase.from("salon_sale_payments").insert({
        sale_id: sale.id,
        business_id: businessId,
        branch_id: tab.branch_id,
        payment_method: input.payment_method,
        amount: Number(input.amount_paid || totalAmount),
        currency_code: input.currency_code || "HTG",
      });
      if (paymentError) throw new Error(paymentError.message);
    }

    for (const item of saleItems) {
      if (item.item_type !== "product") continue;

      const { data: product, error: productError } = await supabase
        .from("salon_products")
        .select("id, quantity_in_stock")
        .eq("id", item.item_id)
        .maybeSingle();
      if (productError) throw new Error(productError.message);

      const previousStock = Number(product?.quantity_in_stock || 0);
      const nextStock = Math.max(0, previousStock - Number(item.quantity || 0));

      const { error: updateError } = await supabase
        .from("salon_products")
        .update({ quantity_in_stock: nextStock })
        .eq("id", item.item_id);
      if (updateError) throw new Error(updateError.message);

      await recordStockMovement({
        business_id: businessId,
        branch_id: tab.branch_id,
        product_id: item.item_id,
        movement_type: "sale",
        quantity_delta: -Number(item.quantity || 0),
        reason: `Vente fiche #${tab.tab_number}`,
        reference_id: sale.id,
      });
    }

    const hasServices = saleItems.some((item) => item.item_type === "service");
    if (input.employee_id && hasServices) {
      for (const item of saleItems) {
        if (item.item_type !== "service") continue;

        const rate = await getCommissionRate(input.employee_id, item.item_id);
        if (!rate) continue;

        const saleAmount = Number(item.quantity || 0) * Number(item.unit_price || 0);
        const commissionAmount = rate.type === "percentage"
          ? saleAmount * (rate.value / 100)
          : rate.value;

        const { error: commissionError } = await supabase.from("commission_transactions").insert({
          business_id: businessId,
          branch_id: tab.branch_id,
          employee_id: input.employee_id,
          sale_id: sale.id,
          service_id: item.item_id,
          rate_type: rate.type,
          rate_value: rate.value,
          sale_amount: saleAmount,
          commission_amount: commissionAmount,
          currency_code: input.currency_code || "HTG",
          status: "pending",
        });
        if (commissionError) throw new Error(commissionError.message);
      }
    }

    const closedTab: PendingTabDetail = {
      ...tab,
      status: "closed",
      closed_at: now,
    };

    updateLocalTab(closedTab);

    return {
      sale: {
        ...sale,
        tab_number: tab.tab_number,
        label: tab.label,
        customer_name: tab.label,
        customer_id: tab.client_id || null,
        opened_at: tab.opened_at,
        closed_at: now,
        cashier_name: input.cashier_name || null,
      },
      items: saleItems,
      tab: closedTab,
    };
  })();
};

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`, init);
  if (!response.ok) {
    throw new Error(`API pending-tabs ${response.status}`);
  }
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new Error("API pending-tabs indisponible (réponse non-JSON)");
  }
  const payload = await response.json();
  return (payload?.data ?? payload) as T;
};

const withLocalFallback = async <T>(
  apiCall: () => Promise<T>,
  localFallback: () => T
): Promise<T> => {
  try {
    return await apiCall();
  } catch {
    console.warn("[pending-tabs] API indisponible, utilisation du stockage local");
    return localFallback();
  }
};

const tryLocalStorage = (): boolean => {
  try {
    localStorage.getItem(LOCAL_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};

export async function listPendingTabs(branchId: string, status: "open" | "closed" | "cancelled" = "open") {
  return withLocalFallback(
    () => fetchJson<PendingTabSummary[]>(`?branch_id=${encodeURIComponent(branchId)}&status=${encodeURIComponent(status)}`),
    () => {
      if (!tryLocalStorage()) return [];
      const state = readLocalState();
      return state.tabs
        .filter((tab) => tab.branch_id === branchId && tab.status === status)
        .map(mapLocalSummary);
    }
  );
}

export async function createPendingTab(input: PendingTabCreateInput) {
  return withLocalFallback(
    () => fetchJson<PendingTabDetail>("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    () => createLocalTab(input)
  );
}

export async function getPendingTab(tabId: string) {
  return withLocalFallback(
    () => fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}`),
    () => {
      const state = readLocalState();
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) throw new Error("Fiche introuvable");
      return tab;
    }
  );
}

export async function addPendingTabItem(tabId: string, input: PendingTabItemInput) {
  return withLocalFallback(
    () => fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    () => {
      const state = readLocalState();
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) throw new Error("Fiche introuvable");
      const updated = addLocalItem(tab, input);
      updateLocalTab(updated);
      return updated;
    }
  );
}

export async function updatePendingTabItem(tabId: string, itemId: string, quantity: number) {
  return withLocalFallback(
    () => fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    }),
    () => {
      const state = readLocalState();
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) throw new Error("Fiche introuvable");
      const items = tab.items.map((item) =>
        item.id === itemId ? { ...item, quantity, subtotal: quantity * item.unit_price } : item
      );
      const updated = { ...tab, items, items_count: items.reduce((s, i) => s + i.quantity, 0), total_amount: items.reduce((s, i) => s + i.subtotal, 0) };
      updateLocalTab(updated);
      return updated;
    }
  );
}

export async function deletePendingTabItem(tabId: string, itemId: string) {
  return withLocalFallback(
    () => fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    }),
    () => {
      const state = readLocalState();
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) throw new Error("Fiche introuvable");
      const updated = deleteLocalItem(tab, itemId);
      updateLocalTab(updated);
      return updated;
    }
  );
}

export async function cancelPendingTab(tabId: string) {
  return withLocalFallback(
    () => fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}/cancel`, {
      method: "PATCH",
    }),
    () => {
      const state = readLocalState();
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) throw new Error("Fiche introuvable");
      const updated = { ...tab, status: "cancelled" as const, closed_at: new Date().toISOString() };
      updateLocalTab(updated);
      return updated;
    }
  );
}

export async function checkoutPendingTab(tabId: string, input: PendingTabCheckoutInput) {
  return withLocalFallback(
    () => fetchJson<{ sale: any; items: any[]; tab: PendingTabDetail | null }>(`/${encodeURIComponent(tabId)}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    () => {
      const state = readLocalState();
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) throw new Error("Fiche introuvable");
      const result = checkoutLocalTab(tab, input) as unknown as { sale: any; items: any[]; tab: PendingTabDetail | null };
      return result;
    }
  );
}

export async function findClientOptions(query: string, branchId?: string | null) {
  let request = supabase
    .from("salon_customers")
    .select("id, first_name, last_name, phone, visit_count")
    .eq("is_active", true)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(6);

  if (branchId) {
    request = request.eq("branch_id", branchId);
  }

  const { data } = await request;

  return (data || []).map((row: any) => ({
    id: row.id,
    name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    phone: row.phone || "",
    visit_count: row.visit_count || 0,
  }));
}
