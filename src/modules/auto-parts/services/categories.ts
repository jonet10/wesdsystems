import { supabase } from "@/lib/supabase";
import type { AutoPartsCategory } from "../types";

export async function listCategories(businessId: string | null) {
  let query = supabase.from("auto_parts_categories").select("*");
  if (businessId) query = query.or(`business_id.eq.${businessId},business_id.is.null`);
  const { data, error } = await query.order("sort_order", { ascending: true });
  if (error) throw error;
  return data as AutoPartsCategory[];
}

export async function createCategory(businessId: string, values: { name: string; description?: string; sort_order?: number }) {
  const { data, error } = await supabase
    .from("auto_parts_categories")
    .insert({ ...values, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data as AutoPartsCategory;
}

export async function updateCategory(id: string, values: Partial<AutoPartsCategory>) {
  const { error } = await supabase.from("auto_parts_categories").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("auto_parts_categories").delete().eq("id", id);
  if (error) throw error;
}
