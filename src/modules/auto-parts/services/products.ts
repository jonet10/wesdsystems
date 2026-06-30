import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { AutoPartsProduct } from "../types";

const getBranch = (businessId: string, branchId?: string | null) =>
  branchId ?? getStoredBranchId(businessId) ?? null;

export async function listProducts(businessId: string, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  let query = supabase
    .from("auto_parts_products")
    .select(`
      id, name, description, category_id, sku, barcode,
      unit_price, cost_price, stock_quantity, reserved_quantity,
      min_stock, max_stock, location, image_url, notes, active,
      business_id, branch_id, created_at, updated_at,
      category:auto_parts_categories(name)
    `)
    .eq("business_id", businessId)
    .order("name", { ascending: true });

  if (branch) {
    query = query.or(`branch_id.is.null,branch_id.eq.${branch}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function listProductsFull(businessId: string, sessionToken?: string | null, branchId?: string | null) {
  return listProducts(businessId, branchId);
}

export async function getProduct(id: string, businessId?: string) {
  let query = supabase
    .from("auto_parts_products")
    .select("*, category:auto_parts_categories(name)")
    .eq("id", id);
  if (businessId) query = query.eq("business_id", businessId);
  const { data, error } = await query.single();
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function createProduct(businessId: string, values: Partial<AutoPartsProduct>) {
  const branch = getBranch(businessId, values.branch_id);
  const payload: Record<string, unknown> = {
    ...values,
    business_id: businessId,
    branch_id: branch ?? null,
    category_id: values.category_id || null,
    unit_price: Number(values.unit_price) || 0,
    cost_price: Number(values.cost_price) || 0,
    stock_quantity: Number(values.stock_quantity) || 0,
    reserved_quantity: 0,
    min_stock: Number(values.min_stock) || 0,
    max_stock: values.max_stock ? Number(values.max_stock) : null,
  };

  const { data, error } = await supabase
    .from("auto_parts_products")
    .insert(payload)
    .select("*, category:auto_parts_categories(name)")
    .single();
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function updateProduct(id: string, values: Partial<AutoPartsProduct>, businessId?: string) {
  const payload: Record<string, unknown> = { ...values };
  if ("unit_price" in values) payload.unit_price = Number(values.unit_price) || 0;
  if ("cost_price" in values) payload.cost_price = Number(values.cost_price) || 0;
  if ("min_stock" in values) payload.min_stock = Number(values.min_stock) || 0;
  if ("max_stock" in values) payload.max_stock = values.max_stock ? Number(values.max_stock) : null;
  payload.updated_at = new Date().toISOString();

  let query = supabase
    .from("auto_parts_products")
    .update(payload)
    .eq("id", id)
    .select("*, category:auto_parts_categories(name)")
    .single();
  if (businessId) {
    query = supabase
      .from("auto_parts_products")
      .update(payload)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("*, category:auto_parts_categories(name)")
      .single();
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as AutoPartsProduct & { category: { name: string } | null };
}

export async function deleteProduct(id: string, businessId?: string) {
  let query = supabase.from("auto_parts_products").delete().eq("id", id);
  if (businessId) query = query.eq("business_id", businessId);
  const { error } = await query;
  if (error) throw error;
}

export async function searchProducts(businessId: string, searchQuery: string, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  let query = supabase
    .from("auto_parts_products")
    .select("*, category:auto_parts_categories(name)")
    .eq("business_id", businessId)
    .ilike("name", `%${searchQuery}%`)
    .limit(50);

  if (branch) {
    query = query.or(`branch_id.is.null,branch_id.eq.${branch}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
