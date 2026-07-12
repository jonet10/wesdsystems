import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { StationerySupplier } from "../types";

export async function listSuppliers(businessId: string, branchId?: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  const { data, error } = await supabase
    .from("stationery_suppliers")
    .select("*")
    .eq("business_id", businessId)
    .eq("branch_id", finalBranchId)
    .order("company_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as StationerySupplier[];
}

export async function createSupplier(
  businessId: string,
  branchId: string,
  values: { company_name: string; contact_name?: string; phone?: string; email?: string; address?: string; notes?: string }
) {
  const { data, error } = await supabase
    .from("stationery_suppliers")
    .insert({ ...values, business_id: businessId, branch_id: branchId })
    .select()
    .single();
  if (error) throw error;
  return data as StationerySupplier;
}

export async function updateSupplier(
  id: string,
  values: Partial<StationerySupplier>,
  businessId?: string
) {
  let q = supabase
    .from("stationery_suppliers")
    .update(values)
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteSupplier(id: string, businessId?: string) {
  let q = supabase
    .from("stationery_suppliers")
    .delete()
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}
