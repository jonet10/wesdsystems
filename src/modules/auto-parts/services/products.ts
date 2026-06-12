import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { AutoPartsProduct } from "../types";

const getBranch = (businessId: string, branchId?: string | null) => branchId ?? getStoredBranchId(businessId) ?? null;

export async function listProducts(businessId: string, branchId?: string | null) {
  const { data, error } = await supabase.rpc("auto_parts_list_products", {
    p_business_id: businessId,
    p_branch_id: getBranch(businessId, branchId),
  });
  if (error) throw error;
  return data as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function listProductsFull(businessId: string, sessionToken?: string | null, branchId?: string | null) {
  const params: Record<string, any> = { p_business_id: businessId, p_branch_id: getBranch(businessId, branchId) };
  if (sessionToken) params.p_session_token = sessionToken;
  const { data, error } = await supabase.rpc("auto_parts_list_products_full", params);
  if (error) throw error;
  return data as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function getProduct(id: string, businessId?: string) {
  const { data, error } = await supabase.rpc("auto_parts_get_product", { p_id: id, p_business_id: businessId ?? null });
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function createProduct(businessId: string, values: Partial<AutoPartsProduct>) {
  const { data, error } = await supabase
    .from("auto_parts_products")
    .insert({ ...values, business_id: businessId })
    .select("*, category:category_id(name)")
    .single();
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function updateProduct(id: string, values: Partial<AutoPartsProduct>, businessId?: string) {
  let q = supabase.from("auto_parts_products").update(values);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string, businessId?: string) {
  let q = supabase.from("auto_parts_products").delete();
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}

export async function searchProducts(businessId: string, searchQuery: string, branchId?: string | null) {
  const { data, error } = await supabase.rpc("auto_parts_search_products", {
    p_business_id: businessId,
    p_query: searchQuery,
    p_branch_id: getBranch(businessId, branchId),
  });
  if (error) throw error;
  return data;
}
