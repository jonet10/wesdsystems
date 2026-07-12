import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { StationeryCategory } from "../types";

export async function listCategories(businessId: string, branchId?: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  const { data, error } = await supabase
    .from("stationery_categories")
    .select("*")
    .eq("business_id", businessId)
    .eq("branch_id", finalBranchId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as StationeryCategory[];
}

export async function createCategory(
  businessId: string,
  branchId: string,
  values: { name: string; description?: string; color?: string; icon?: string }
) {
  const { data, error } = await supabase
    .from("stationery_categories")
    .insert({ ...values, business_id: businessId, branch_id: branchId })
    .select()
    .single();
  if (error) throw error;
  return data as StationeryCategory;
}

export async function updateCategory(
  id: string,
  values: Partial<StationeryCategory>,
  businessId?: string
) {
  let q = supabase
    .from("stationery_categories")
    .update(values)
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteCategory(id: string, businessId?: string) {
  let q = supabase
    .from("stationery_categories")
    .delete()
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}
