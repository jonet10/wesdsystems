import { supabase } from "@/lib/supabase";
import type { AutoPartsModel } from "../types";

export async function listModels(brandId?: string) {
  let query = supabase.from("auto_parts_models").select("*, brand:brand_id(name)");
  if (brandId) query = query.eq("brand_id", brandId);
  const { data, error } = await query.order("name");
  if (error) throw error;
  return data as (AutoPartsModel & { brand: { name: string } })[];
}

export async function createModel(values: { brand_id: string; name: string; start_year?: number | null; end_year?: number | null }) {
  const { data, error } = await supabase.from("auto_parts_models").insert(values).select("*, brand:brand_id(name)").single();
  if (error) throw error;
  return data as AutoPartsModel & { brand: { name: string } };
}

export async function updateModel(id: string, values: Partial<AutoPartsModel>) {
  const { error } = await supabase.from("auto_parts_models").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteModel(id: string) {
  const { error } = await supabase.from("auto_parts_models").delete().eq("id", id);
  if (error) throw error;
}
