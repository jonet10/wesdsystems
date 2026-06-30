import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { AutoPartsCategory } from "../types";

const getBranch = (businessId: string, branchId?: string | null) => branchId ?? getStoredBranchId(businessId) ?? null;

export async function listCategories(businessId: string, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  const params: Record<string, any> = { p_business_id: businessId };
  if (branch) params.p_branch_id = branch;
  const { data, error } = await supabase.rpc("auto_parts_list_categories", params);
  if (error) throw error;
  return data as AutoPartsCategory[];
}

export async function createCategory(businessId: string, values: { name: string; description?: string; sort_order?: number }) {
  const { data, error } = await supabase.rpc("upsert_auto_parts_category", {
    p_category_id: null,
    p_values: values,
  });
  if (error) throw error;
  return data as AutoPartsCategory;
}

export async function updateCategory(id: string, values: Partial<AutoPartsCategory>, businessId?: string) {
  const { error } = await supabase.rpc("upsert_auto_parts_category", {
    p_category_id: id,
    p_values: values,
  });
  if (error) throw error;
}

export async function deleteCategory(id: string, businessId?: string) {
  const { error } = await supabase.rpc("delete_auto_parts_category", {
    p_category_id: id,
  });
  if (error) throw error;
}
