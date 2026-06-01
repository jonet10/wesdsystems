import { supabase } from "@/lib/supabase";
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
  const sale = {
    id: crypto.randomUUID(),
    sale_number: tab.tab_number,
    total_amount: tab.total_amount,
    subtotal: tab.total_amount,
    discount_amount: 0,
    payment_method: input.payment_method,
    amount_paid: input.amount_paid,
    created_at: now,
    cashier_id: input.cashier_id || tab.cashier_id || null,
    cashier_name: input.cashier_name || null,
    branch_id: tab.branch_id,
    status: "completed",
  };

  const closedTab: PendingTabDetail = {
    ...tab,
    status: "closed",
    closed_at: now,
  };

  updateLocalTab(closedTab);
  return { sale, items: tab.items, tab: closedTab };
};

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T | null> => {
  try {
    const response = await fetch(`${apiBase}${path}`, init);
    if (response.status === 404) return null;
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Une erreur est survenue");
    }
    const payload = await response.json().catch(() => null);
    return (payload?.data ?? payload ?? null) as T;
  } catch {
    return null;
  }
};

export async function listPendingTabs(branchId: string, status: "open" | "closed" | "cancelled" = "open") {
  const remote = await fetchJson<PendingTabSummary[]>(`?branch_id=${encodeURIComponent(branchId)}&status=${encodeURIComponent(status)}`);
  if (remote) return remote;

  const state = readLocalState();
  const today = startOfTodayIso();
  const tomorrow = endOfToday();
  return state.tabs
    .filter((tab) => tab.branch_id === branchId && tab.status === status && tab.opened_at >= today && tab.opened_at <= tomorrow)
    .map(mapLocalSummary);
}

export async function createPendingTab(input: PendingTabCreateInput) {
  const remote = await fetchJson<PendingTabDetail>("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (remote) return remote;
  return createLocalTab(input);
}

export async function getPendingTab(tabId: string) {
  const remote = await fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}`);
  if (remote) return remote;
  const state = readLocalState();
  const tab = state.tabs.find((entry) => entry.id === tabId);
  if (!tab) throw new Error("Fiche introuvable");
  return tab;
}

export async function addPendingTabItem(tabId: string, input: PendingTabItemInput) {
  const remote = await fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (remote) return remote;
  const state = readLocalState();
  const tab = state.tabs.find((entry) => entry.id === tabId);
  if (!tab) throw new Error("Fiche introuvable");
  return updateLocalTab(addLocalItem(tab, input));
}

export async function updatePendingTabItem(tabId: string, itemId: string, quantity: number) {
  const remote = await fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });
  if (remote) return remote;
  const state = readLocalState();
  const tab = state.tabs.find((entry) => entry.id === tabId);
  if (!tab) throw new Error("Fiche introuvable");
  const items = tab.items.map((item) =>
    item.id === itemId
      ? { ...item, quantity: Math.max(1, Number(quantity || 1)), subtotal: Number(item.unit_price || 0) * Math.max(1, Number(quantity || 1)) }
      : item
  );
  return updateLocalTab({
    ...tab,
    items,
    items_count: items.reduce((sum, entry) => sum + toNumber(entry.quantity), 0),
    total_amount: items.reduce((sum, entry) => sum + toNumber(entry.subtotal), 0),
  });
}

export async function deletePendingTabItem(tabId: string, itemId: string) {
  const remote = await fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
  if (remote) return remote;
  const state = readLocalState();
  const tab = state.tabs.find((entry) => entry.id === tabId);
  if (!tab) throw new Error("Fiche introuvable");
  return updateLocalTab(deleteLocalItem(tab, itemId));
}

export async function cancelPendingTab(tabId: string) {
  const remote = await fetchJson<PendingTabDetail>(`/${encodeURIComponent(tabId)}/cancel`, {
    method: "PATCH",
  });
  if (remote) return remote;
  const state = readLocalState();
  const tab = state.tabs.find((entry) => entry.id === tabId);
  if (!tab) throw new Error("Fiche introuvable");
  return updateLocalTab({ ...tab, status: "cancelled", closed_at: new Date().toISOString() });
}

export async function checkoutPendingTab(tabId: string, input: PendingTabCheckoutInput) {
  const remote = await fetchJson<{ sale: any; items: any[]; tab: PendingTabDetail | null }>(`/${encodeURIComponent(tabId)}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (remote) return remote;
  const state = readLocalState();
  const tab = state.tabs.find((entry) => entry.id === tabId);
  if (!tab) throw new Error("Fiche introuvable");
  return checkoutLocalTab(tab, input);
}

export async function findClientOptions(query: string) {
  const { data } = await supabase
    .from("salon_customers")
    .select("id, first_name, last_name, phone, visit_count")
    .eq("is_active", true)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(6);

  return (data || []).map((row: any) => ({
    id: row.id,
    name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    phone: row.phone || "",
    visit_count: row.visit_count || 0,
  }));
}
