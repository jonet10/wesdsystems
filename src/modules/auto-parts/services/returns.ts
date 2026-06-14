import { supabase } from "@/lib/supabase";

export interface AutoPartsReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface AutoPartsReturnRequest {
  id: string;
  business_id: string;
  sale_id: string;
  invoice_number: string;
  staff_id: string | null;
  staff_name: string | null;
  reason: string | null;
  status: "EN_ATTENTE" | "APPROUVE" | "REFUSE";
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  items: AutoPartsReturnItem[];
}

// ─── Legacy: kept for backward compat with old stock-movement returns ─────────
export async function listReturns(businessId: string | null) {
  if (!businessId) return [];
  const { data, error } = await supabase.rpc("auto_parts_list_returns", { p_business_id: businessId });
  if (error) throw error;
  return data as any[];
}

// ─── New workflow: return requests with validation ────────────────────────────

/** Cashier creates a return request → status EN_ATTENTE */
export async function createReturnRequest(
  businessId: string,
  saleId: string,
  items: AutoPartsReturnItem[],
  staffId?: string | null,
  reason?: string
) {
  const { data, error } = await supabase.rpc("create_auto_parts_return_request", {
    p_business_id: businessId,
    p_sale_id: saleId,
    p_staff_id: staffId ?? null,
    p_reason: reason ?? null,
    p_items: JSON.parse(JSON.stringify(items)),
  });
  if (error) throw error;
  return data as { success: boolean; error?: string; request_id?: string; status?: string };
}

/** Admin/Manager: list all return requests, optionally filtered by staff or status */
export async function listReturnRequests(
  businessId: string,
  staffId?: string | null,
  status?: "EN_ATTENTE" | "APPROUVE" | "REFUSE" | null
) {
  const { data, error } = await supabase.rpc("auto_parts_list_return_requests", {
    p_business_id: businessId,
    p_staff_id: staffId ?? null,
    p_status: status ?? null,
  });
  if (error) throw error;
  return data as AutoPartsReturnRequest[];
}

/** Admin/Manager: approve a return request → restock + update sale status */
export async function approveReturn(requestId: string, reviewerId?: string | null) {
  const { data, error } = await supabase.rpc("approve_auto_parts_return", {
    p_request_id: requestId,
    p_reviewer_id: reviewerId ?? null,
  });
  if (error) throw error;
  return data as { success: boolean; error?: string; refund_status?: string };
}

/** Admin/Manager: reject a return request */
export async function rejectReturn(
  requestId: string,
  reviewerId?: string | null,
  rejectionReason?: string
) {
  const { data, error } = await supabase.rpc("reject_auto_parts_return", {
    p_request_id: requestId,
    p_reviewer_id: reviewerId ?? null,
    p_rejection_reason: rejectionReason ?? null,
  });
  if (error) throw error;
  return data as { success: boolean; error?: string; status?: string };
}

// ─── Legacy processReturn (kept for backward compat, now deprecated) ──────────
/** @deprecated Use createReturnRequest instead */
export async function processReturn(businessId: string, saleId: string, items: AutoPartsReturnItem[], reason?: string) {
  const { data, error } = await supabase.rpc("process_auto_parts_return", {
    p_business_id: businessId,
    p_sale_id: saleId,
    p_items: JSON.parse(JSON.stringify(items)),
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as { success: boolean; error?: string; sale_id: string; refund_status: string };
}
