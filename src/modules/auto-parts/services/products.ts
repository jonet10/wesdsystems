import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { AutoPartsProduct } from "../types";

const getBranch = (businessId: string, branchId?: string | null) => branchId ?? getStoredBranchId(businessId) ?? null;

export async function listProducts(businessId: string, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  const { data, error } = await supabase.rpc("auto_parts_list_products", {
    p_business_id: businessId,
    p_branch_id: branch,
  });
  if (error) throw error;
  return data as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function listProductsFull(businessId: string, sessionToken?: string | null, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  const { data, error } = await supabase.rpc("auto_parts_list_products_full", {
    p_business_id: businessId,
    p_session_token: sessionToken ?? null,
    p_branch_id: branch,
  });
  if (error) throw error;
  return data as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function getProduct(id: string, businessId?: string) {
  const { data, error } = await supabase.rpc("auto_parts_get_product", { p_id: id, p_business_id: businessId ?? null });
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function createProduct(businessId: string, values: Partial<AutoPartsProduct>) {
  const branch = getBranch(businessId, values.branch_id);
  const { data, error } = await supabase.rpc("upsert_auto_parts_product", {
    p_business_id: businessId,
    p_product_id: null,
    p_values: values,
    p_branch_id: branch,
  });
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function updateProduct(id: string, values: Partial<AutoPartsProduct>, businessId?: string) {
  if (!businessId) throw new Error("businessId is required");
  const branch = getBranch(businessId, values.branch_id);
  const { data, error } = await supabase.rpc("upsert_auto_parts_product", {
    p_business_id: businessId,
    p_product_id: id,
    p_values: values,
    p_branch_id: branch,
  });
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function deleteProduct(id: string, businessId?: string) {
  if (!businessId) throw new Error("businessId is required");
  const { error } = await supabase.rpc("delete_auto_parts_product_for_business", {
    p_product_id: id,
    p_business_id: businessId,
  });
  if (error) throw error;
}

export async function searchProducts(businessId: string, searchQuery: string, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  const params: Record<string, any> = { p_business_id: businessId, p_query: searchQuery };
  if (branch) params.p_branch_id = branch;
  const { data, error } = await supabase.rpc("auto_parts_search_products", params);
  if (error) throw error;
  return data;
}
