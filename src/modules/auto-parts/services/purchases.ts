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
    p_items: JSON.stringify(purchase.items),
  });
  if (error) throw error;
  return data;
}

export async function updatePurchaseStatus(id: string, status: string) {
  const { error } = await supabase.from("auto_parts_purchases").update({ status }).eq("id", id);
  if (error) throw error;
}
