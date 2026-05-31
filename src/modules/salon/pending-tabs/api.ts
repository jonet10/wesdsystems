import { supabase } from "@/lib/supabase";
import type {
  PendingTabCheckoutInput,
  PendingTabCreateInput,
  PendingTabDetail,
  PendingTabItemInput,
  PendingTabSummary,
} from "./types";

const parseResponse = async <T>(response: Response): Promise<T> => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Une erreur est survenue");
  }
  return payload?.data as T;
};

const apiBase = "/api/pending-tabs";

export async function listPendingTabs(branchId: string, status: "open" | "closed" | "cancelled" = "open") {
  const response = await fetch(`${apiBase}?branch_id=${encodeURIComponent(branchId)}&status=${encodeURIComponent(status)}`);
  const payload = await parseResponse<{ data: PendingTabSummary[] } | PendingTabSummary[]>(response);
  return Array.isArray(payload) ? payload : (payload as any).data || [];
}

export async function createPendingTab(input: PendingTabCreateInput) {
  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<PendingTabDetail>(response);
}

export async function getPendingTab(tabId: string) {
  const response = await fetch(`${apiBase}/${encodeURIComponent(tabId)}`);
  return parseResponse<PendingTabDetail>(response);
}

export async function addPendingTabItem(tabId: string, input: PendingTabItemInput) {
  const response = await fetch(`${apiBase}/${encodeURIComponent(tabId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<PendingTabDetail>(response);
}

export async function updatePendingTabItem(tabId: string, itemId: string, quantity: number) {
  const response = await fetch(`${apiBase}/${encodeURIComponent(tabId)}/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });
  return parseResponse<PendingTabDetail>(response);
}

export async function deletePendingTabItem(tabId: string, itemId: string) {
  const response = await fetch(`${apiBase}/${encodeURIComponent(tabId)}/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
  return parseResponse<PendingTabDetail>(response);
}

export async function cancelPendingTab(tabId: string) {
  const response = await fetch(`${apiBase}/${encodeURIComponent(tabId)}/cancel`, {
    method: "PATCH",
  });
  return parseResponse<PendingTabDetail>(response);
}

export async function checkoutPendingTab(tabId: string, input: PendingTabCheckoutInput) {
  const response = await fetch(`${apiBase}/${encodeURIComponent(tabId)}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<{ sale: any; items: any[]; tab: PendingTabDetail | null }>(response);
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

