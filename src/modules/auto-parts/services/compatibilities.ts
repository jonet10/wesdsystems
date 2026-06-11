import { supabase } from "@/lib/supabase";
import type { AutoPartsVehicleCompatibility } from "../types";

export async function listCompatibilities(businessId: string, productId?: string) {
  let query = supabase
    .from("auto_parts_vehicle_compatibilities")
    .select("*, product:product_id(name), brand:brand_id(name), model:model_id(name)")
    .eq("business_id", businessId);
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data as (AutoPartsVehicleCompatibility & { product: { name: string }; brand: { name: string } | null; model: { name: string } | null })[];
}

export async function createCompatibility(businessId: string, values: Partial<AutoPartsVehicleCompatibility>) {
  const { data, error } = await supabase.from("auto_parts_vehicle_compatibilities").insert({ ...values, business_id: businessId }).select("*, product:product_id(name), brand:brand_id(name), model:model_id(name)").single();
  if (error) throw error;
  return data;
}

export async function deleteCompatibility(id: string, businessId?: string) {
  let q = supabase.from("auto_parts_vehicle_compatibilities").delete();
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}
