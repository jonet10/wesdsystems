import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { StationeryCustomer } from "../types";

export async function listCustomers(businessId: string, branchId?: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  const { data, error } = await supabase
    .from("stationery_customers")
    .select("*")
    .eq("business_id", businessId)
    .eq("branch_id", finalBranchId)
    .order("first_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as StationeryCustomer[];
}

export async function searchClients(query: string, businessId: string, branchId?: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  const { data, error } = await supabase
    .from("stationery_customers")
    .select("id, first_name, last_name, phone")
    .eq("business_id", businessId)
    .eq("branch_id", finalBranchId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(10);

  if (error) throw error;
  return (data || []).map(c => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name || ''}`.trim()
  }));
}

export async function createCustomer(
  businessId: string,
  branchId: string,
  values: { first_name: string; last_name?: string; phone?: string; email?: string; address?: string; notes?: string }
) {
  const { data, error } = await supabase
    .from("stationery_customers")
    .insert({ ...values, business_id: businessId, branch_id: branchId })
    .select()
    .single();
  if (error) throw error;
  return data as StationeryCustomer;
}

export async function updateCustomer(
  id: string,
  values: Partial<StationeryCustomer>,
  businessId?: string
) {
  let q = supabase
    .from("stationery_customers")
    .update(values)
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteCustomer(id: string, businessId?: string) {
  let q = supabase
    .from("stationery_customers")
    .delete()
    .eq("id", id);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q;
  if (error) throw error;
}
