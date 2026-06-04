import { supabase } from "@/lib/supabase";
import type { AutoPartsSupplier } from "../types";

export async function listSuppliers() {
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
