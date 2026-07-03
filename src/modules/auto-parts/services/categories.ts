import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { AutoPartsCategory } from "../types";

const getBranch = (businessId: string, branchId?: string | null) =>
  branchId || getStoredBranchId(businessId) || null;

export async function listCategories(businessId: string, branchId?: string | null) {
  // Direct query — only categories belonging to this business (strict isolation)
  const { data, error } = await supabase
    .from("auto_parts_categories")
    .select("id, name, description, icon, sort_order, business_id, branch_id")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AutoPartsCategory[];
}

export async function createCategory(
  businessId: string,
  values: { name: string; description?: string; sort_order?: number; icon?: string }
) {
  const { data, error } = await supabase
    .from("auto_parts_categories")
    .insert({ ...values, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data as AutoPartsCategory;
}

export async function updateCategory(
  id: string,
  values: Partial<AutoPartsCategory>,
  businessId?: string
) {
  let q = supabase
    .from("auto_parts_categories")
    .update(values)
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteCategory(id: string, businessId?: string) {
  let q = supabase
    .from("auto_parts_categories")
    .delete()
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}
