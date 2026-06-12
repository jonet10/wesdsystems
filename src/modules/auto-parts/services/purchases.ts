import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { AutoPartsPurchase, AutoPartsPurchaseItem } from "../types";

const getBranch = (businessId: string, branchId?: string | null) => branchId ?? getStoredBranchId(businessId) ?? null;

export async function listPurchases(businessId: string, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  const params: Record<string, any> = { p_business_id: businessId };
  if (branch) params.p_branch_id = branch;
  const { data, error } = await supabase.rpc("auto_parts_list_purchases", params);
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
  branch_id?: string | null;
  items: { product_id?: string | null; product_name: string; quantity: number; unit_price: number }[];
}) {
  const branch = purchase.branch_id ?? getBranch(businessId);
  const params: Record<string, any> = {
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
  };
  if (branch) params.p_branch_id = branch;
  const { data, error } = await supabase.rpc("create_auto_parts_purchase", params);
  if (error) throw error;
  return data;
}

export async function updatePurchaseStatus(id: string, status: string, businessId?: string) {
  const { data, error } = await supabase.rpc("update_auto_parts_purchase", {
    p_id: id,
    p_business_id: businessId ?? null,
    p_status: status,
  });
  if (error) throw error;
  return data;
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
