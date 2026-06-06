import { supabase } from "@/lib/supabase";
import type { AutoPartsCategory } from "../types";

export async function listCategories(businessId: string | null) {
  if (businessId) {
    const { data, error } = await supabase.rpc("auto_parts_list_categories", { p_business_id: businessId });
    if (error) throw error;
    return data as AutoPartsCategory[];
  }
  const { data, error } = await supabase.from("auto_parts_categories").select("*").order("sort_order", { ascending: true });
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
