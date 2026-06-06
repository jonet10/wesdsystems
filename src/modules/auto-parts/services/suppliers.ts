import { supabase } from "@/lib/supabase";
import type { AutoPartsSupplier } from "../types";

export async function listSuppliers(businessId?: string | null) {
  if (businessId) {
    const { data, error } = await supabase.rpc("auto_parts_list_suppliers", { p_business_id: businessId });
    if (error) throw error;
    return data as AutoPartsSupplier[];
  }
  const { data, error } = await supabase.from("auto_parts_suppliers").select("*").order("name");
  if (error) throw error;
  return data as AutoPartsSupplier[];
}

export async function createSupplier(values: Partial<AutoPartsSupplier>) {
  const { data, error } = await supabase.from("auto_parts_suppliers").insert(values).select().single();
  if (error) throw error;
  return data as AutoPartsSupplier;
}

export async function updateSupplier(id: string, values: Partial<AutoPartsSupplier>) {
  const { error } = await supabase.from("auto_parts_suppliers").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.from("auto_parts_suppliers").delete().eq("id", id);
  if (error) throw error;
}
