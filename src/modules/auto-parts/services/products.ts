import { supabase } from "@/lib/supabase";
import type { AutoPartsProduct } from "../types";

export async function listProducts(businessId: string) {
  const { data, error } = await supabase
    .from("auto_parts_products")
    .select("*, category:category_id(name)")
    .eq("business_id", businessId)
    .order("name");
  if (error) throw error;
  return data as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function getProduct(id: string) {
  const { data, error } = await supabase.from("auto_parts_products").select("*, category:category_id(name)").eq("id", id).single();
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

export async function updateProduct(id: string, values: Partial<AutoPartsProduct>) {
  const { error } = await supabase.from("auto_parts_products").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("auto_parts_products").delete().eq("id", id);
  if (error) throw error;
}

export async function searchProducts(businessId: string, query: string) {
  const { data, error } = await supabase
    .from("auto_parts_products")
    .select("id, name, sku, unit_price, stock_quantity, active")
    .eq("business_id", businessId)
    .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
    .order("name")
    .limit(20);
  if (error) throw error;
  return data;
}
