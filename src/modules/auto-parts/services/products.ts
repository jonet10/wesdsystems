import { supabase } from "@/lib/supabase";
import type { AutoPartsProduct } from "../types";

export async function listProducts(businessId: string) {
  const { data, error } = await supabase.rpc("auto_parts_list_products", { p_business_id: businessId });
  if (error) throw error;
  return data as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function listProductsFull(businessId: string) {
  const { data, error } = await supabase.rpc("auto_parts_list_products_full", { p_business_id: businessId });
  if (error) throw error;
  return data as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function getProduct(id: string, businessId?: string) {
  const { data, error } = await supabase.rpc("auto_parts_get_product", { p_id: id, p_business_id: businessId ?? null });
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function createProduct(businessId: string, values: Partial<AutoPartsProduct>) {
  const { data, error } = await supabase
    .from("auto_parts_products")
    .insert({ ...values, business_id: businessId })
    .select("*, category:category_id(name)")
    .single();
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function updateProduct(id: string, values: Partial<AutoPartsProduct>, businessId?: string) {
  let q = supabase.from("auto_parts_products").update(values);
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string, businessId?: string) {
  let q = supabase.from("auto_parts_products").delete();
  if (businessId) q = q.eq("business_id", businessId);
  const { error } = await q.eq("id", id);
  if (error) throw error;
}

export async function searchProducts(businessId: string, searchQuery: string) {
  const { data, error } = await supabase.rpc("auto_parts_search_products", { p_business_id: businessId, p_query: searchQuery });
  if (error) throw error;
  return data;
}
