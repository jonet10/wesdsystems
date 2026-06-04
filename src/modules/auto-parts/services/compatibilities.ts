import { supabase } from "@/lib/supabase";
import type { AutoPartsVehicleCompatibility } from "../types";

export async function listCompatibilities(productId?: string) {
  let query = supabase
    .from("auto_parts_vehicle_compatibilities")
    .select("*, product:product_id(name), brand:brand_id(name), model:model_id(name)");
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data as (AutoPartsVehicleCompatibility & { product: { name: string }; brand: { name: string } | null; model: { name: string } | null })[];
}

export async function createCompatibility(values: Partial<AutoPartsVehicleCompatibility>) {
  const { data, error } = await supabase.from("auto_parts_vehicle_compatibilities").insert(values).select("*, product:product_id(name), brand:brand_id(name), model:model_id(name)").single();
  if (error) throw error;
  return data;
}

export async function deleteCompatibility(id: string) {
  const { error } = await supabase.from("auto_parts_vehicle_compatibilities").delete().eq("id", id);
  if (error) throw error;
}
