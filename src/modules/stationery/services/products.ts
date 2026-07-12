import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { StationeryProduct } from "../types";

export async function listProducts(businessId: string, branchId?: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  const { data, error } = await supabase
    .from("stationery_products")
    .select(`
      *,
      category:stationery_categories(id, name, color)
    `)
    .eq("business_id", businessId)
    .eq("branch_id", finalBranchId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as (StationeryProduct & { category?: any })[];
}

export async function createProduct(
  businessId: string,
  branchId: string,
  values: Partial<StationeryProduct>
) {
  const { data, error } = await supabase
    .from("stationery_products")
    .insert({ ...values, business_id: businessId, branch_id: branchId })
    .select()
    .single();
  if (error) throw error;
  return data as StationeryProduct;
}

export async function updateProduct(
  id: string,
  values: Partial<StationeryProduct>,
  businessId?: string
) {
  let q = supabase
    .from("stationery_products")
    .update(values)
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteProduct(id: string, businessId?: string) {
  let q = supabase
    .from("stationery_products")
    .delete()
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}
