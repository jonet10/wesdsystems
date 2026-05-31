import type { PendingTabDetail, PendingTabSummary } from "../../src/modules/salon/pending-tabs";
import { apiSupabase } from "../_supabase";

const json = (res: any, status: number, payload: any) => {
  res.status(status).json(payload);
};

const startOfTodayIso = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
};

const toNumber = (value: unknown) => Number(value || 0);

const mapTab = (tab: any): PendingTabDetail => {
  const items = (tab.pending_tab_items || []).map((item: any) => ({
    id: item.id,
    tab_id: item.tab_id,
    item_type: item.item_type,
    item_id: item.item_id,
    item_name: item.item_name,
    unit_price: Number(item.unit_price || 0),
    quantity: Number(item.quantity || 0),
    subtotal: Number(item.subtotal || 0),
    added_at: item.added_at,
    added_by: item.added_by || null,
  }));

  return {
    id: tab.id,
    tab_number: tab.tab_number,
    label: tab.label,
    client_id: tab.client_id || null,
    guest_name: tab.guest_name || null,
    status: tab.status,
    branch_id: tab.branch_id,
    cashier_id: tab.cashier_id || null,
    opened_at: tab.opened_at,
    closed_at: tab.closed_at || null,
    notes: tab.notes || null,
    items,
    items_count: items.reduce((sum, item) => sum + toNumber(item.quantity), 0),
    total_amount: items.reduce((sum, item) => sum + toNumber(item.subtotal), 0),
  };
};

export async function loadTabDetail(tabId: string) {
  const { data, error } = await apiSupabase
    .from("pending_tabs")
    .select(`
      id,
      tab_number,
      label,
      client_id,
      guest_name,
      status,
      branch_id,
      cashier_id,
      opened_at,
      closed_at,
      notes,
      pending_tab_items (
        id,
        tab_id,
        item_type,
        item_id,
        item_name,
        unit_price,
        quantity,
        subtotal,
        added_at,
        added_by
      )
    `)
    .eq("id", tabId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapTab(data);
}

export async function loadTabSummaryList(branchId: string, status = "open") {
  const { data, error } = await apiSupabase
    .from("pending_tabs")
    .select(`
      id,
      tab_number,
      label,
      client_id,
      guest_name,
      status,
      branch_id,
      cashier_id,
      opened_at,
      closed_at,
      notes,
      pending_tab_items (
        id,
        subtotal,
        quantity
      )
    `)
    .eq("branch_id", branchId)
    .eq("status", status)
    .gte("opened_at", startOfTodayIso())
    .order("opened_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((tab: any): PendingTabSummary => {
    const items = tab.pending_tab_items || [];
    return {
      id: tab.id,
      tab_number: tab.tab_number,
      label: tab.label,
      client_id: tab.client_id || null,
      guest_name: tab.guest_name || null,
      status: tab.status,
      branch_id: tab.branch_id,
      cashier_id: tab.cashier_id || null,
      opened_at: tab.opened_at,
      closed_at: tab.closed_at || null,
      notes: tab.notes || null,
      items_count: items.reduce((sum: number, item: any) => sum + toNumber(item.quantity), 0),
      total_amount: items.reduce((sum: number, item: any) => sum + toNumber(item.subtotal), 0),
    };
  });
}

export { json, mapTab };

