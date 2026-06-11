import { supabase } from "@/lib/supabase";
import type { AutoPartsSupplier } from "../types";

export async function listSuppliers(businessId: string) {
  const { data, error } = await supabase.rpc("auto_parts_list_suppliers", { p_business_id: businessId });
  if (error) throw error;
  return data as AutoPartsSupplier[];
}

export async function createSupplier(businessId: string, values: Partial<AutoPartsSupplier>) {
  const { data, error } = await supabase.from("auto_parts_suppliers").insert({ ...values, business_id: businessId }).select().single();
  if (error) throw error;
  return data as AutoPartsSupplier;
}

export async function updateSupplier(id: string, values: Partial<AutoPartsSupplier>, businessId?: string) {
  let q = supabase.from("auto_parts_suppliers").update(values);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}

export async function deleteSupplier(id: string, businessId?: string) {
  let q = supabase.from("auto_parts_suppliers").delete();
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}
