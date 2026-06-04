import { supabase } from "@/lib/supabase";
import type { AutoPartsBrand } from "../types";

export async function listBrands() {
  const { data, error } = await supabase.from("auto_parts_brands").select("*").order("name");
  if (error) throw error;
  return data as AutoPartsBrand[];
}

export async function createBrand(values: { name: string }) {
  const { data, error } = await supabase.from("auto_parts_brands").insert(values).select().single();
  if (error) throw error;
  return data as AutoPartsBrand;
}

export async function updateBrand(id: string, values: { name: string }) {
  const { error } = await supabase.from("auto_parts_brands").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteBrand(id: string) {
  const { error } = await supabase.from("auto_parts_brands").delete().eq("id", id);
  if (error) throw error;
}
