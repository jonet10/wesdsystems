import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";

const getBranch = (businessId: string, branchId?: string | null) => branchId ?? getStoredBranchId(businessId) ?? null;

export interface DeliveryNoteItem {
  id?: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit?: string;
}

export interface DeliveryNote {
  id: string;
  delivery_note_number: string;
  sale_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  status: string;
  delivered_at?: string | null;
  notes?: string | null;
  items?: DeliveryNoteItem[];
  created_at: string;
  updated_at: string;
}

export async function listDeliveryNotes(businessId: string, branchId?: string | null) {
  const { data, error } = await supabase.rpc("list_auto_parts_delivery_notes", {
    p_business_id: businessId,
    p_branch_id: getBranch(businessId, branchId),
  });
  if (error) throw error;
  return data as DeliveryNote[];
}

export async function getDeliveryNote(id: string, businessId?: string) {
  const { data, error } = await supabase.rpc("get_auto_parts_delivery_note", { p_id: id, p_business_id: businessId ?? null });
  if (error) throw error;
  return data as DeliveryNote;
}

export async function createDeliveryNote(
  businessId: string,
  note: {
    sale_id?: string | null;
    client_id?: string | null;
    client_name?: string;
    client_phone?: string;
    client_address?: string;
    status?: string;
    notes?: string;
    prefix?: string;
    branch_id?: string | null;
    items: DeliveryNoteItem[];
  }
) {
  const { data, error } = await supabase.rpc("create_auto_parts_delivery_note", {
    p_business_id: businessId,
    p_sale_id: note.sale_id ?? null,
    p_client_id: note.client_id ?? null,
    p_client_name: note.client_name ?? null,
    p_client_phone: note.client_phone ?? null,
    p_client_address: note.client_address ?? null,
    p_status: note.status ?? "draft",
    p_notes: note.notes ?? null,
    p_prefix: note.prefix ?? "BL-",
    p_branch_id: note.branch_id ?? getBranch(businessId) ?? null,
    p_items: note.items as any,
  });
  if (error) throw error;
  return data as { id: string; delivery_note_number: string };
}

export async function updateDeliveryNote(
  id: string,
  note: { status?: string; notes?: string; items?: DeliveryNoteItem[] },
  businessId?: string
) {
  const { data, error } = await supabase.rpc("update_auto_parts_delivery_note", {
    p_id: id,
    p_business_id: businessId ?? null,
    p_status: note.status ?? null,
    p_notes: note.notes ?? null,
    p_items: note.items ?? null,
  });
  if (error) throw error;
  return data;
}

export async function deleteDeliveryNote(id: string, businessId?: string) {
  const { data, error } = await supabase.rpc("delete_auto_parts_delivery_note", { p_id: id, p_business_id: businessId ?? null });
  if (error) throw error;
  return data;
}
