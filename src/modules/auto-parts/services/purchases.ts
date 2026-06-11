import { supabase } from "@/lib/supabase";
import type { AutoPartsPurchase, AutoPartsPurchaseItem } from "../types";

export async function listPurchases(businessId: string) {
  const { data, error } = await supabase
    .from("auto_parts_purchases")
    .select("*, items:auto_parts_purchase_items(*)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as (AutoPartsPurchase & { items: AutoPartsPurchaseItem[] })[];
}

export async function createPurchase(businessId: string, purchase: {
  supplier_id?: string | null;
  supplier_name?: string;
  reference_number?: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes?: string;
  items: { product_id?: string | null; product_name: string; quantity: number; unit_price: number }[];
}) {
  const { data, error } = await supabase.rpc("create_auto_parts_purchase", {
    p_business_id: businessId,
    p_supplier_id: purchase.supplier_id ?? null,
    p_supplier_name: purchase.supplier_name ?? null,
    p_reference_number: purchase.reference_number ?? null,
    p_status: purchase.status,
    p_subtotal: purchase.subtotal,
    p_tax_amount: purchase.tax_amount,
    p_total: purchase.total,
    p_notes: purchase.notes ?? null,
    p_items: purchase.items as any,
  });
  if (error) throw error;
  return data;
}

export async function updatePurchaseStatus(id: string, status: string, businessId?: string) {
  let q = supabase.from("auto_parts_purchases").update({ status });
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}

export async function updatePurchase(id: string, purchase: {
  supplier_id?: string | null;
  supplier_name?: string;
  reference_number?: string;
  status?: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes?: string;
  items: { product_id?: string | null; product_name: string; quantity: number; unit_price: number }[];
}, businessId?: string) {
  const { data, error } = await supabase.rpc("update_auto_parts_purchase", {
    p_id: id,
    p_business_id: businessId ?? null,
    p_supplier_id: purchase.supplier_id ?? null,
    p_supplier_name: purchase.supplier_name ?? null,
    p_reference_number: purchase.reference_number ?? null,
    p_status: purchase.status ?? null,
    p_subtotal: purchase.subtotal,
    p_tax_amount: purchase.tax_amount,
    p_total: purchase.total,
    p_notes: purchase.notes ?? null,
    p_items: purchase.items as any,
  });
  if (error) throw error;
  return data;
}

export async function deletePurchase(id: string, businessId?: string) {
  const { data, error } = await supabase.rpc("delete_auto_parts_purchase", { p_id: id, p_business_id: businessId ?? null });
  if (error) throw error;
  return data;
}
