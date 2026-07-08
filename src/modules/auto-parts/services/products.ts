import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { AutoPartsProduct } from "../types";

const getBranch = (businessId: string, branchId?: string | null) =>
  branchId || getStoredBranchId(businessId) || null;

// -------------------------------------------------------------------
// Helper: merge product catalog row with its inventory row
// -------------------------------------------------------------------
function mergeInventory(
  p: Record<string, unknown>,
  inv: Record<string, unknown> | null
): AutoPartsProduct & { category: { name: string } | null } {
  return {
    ...(p as AutoPartsProduct),
    business_id: (inv?.business_id ?? p.business_id ?? null) as string,
    branch_id: (inv?.branch_id ?? p.branch_id ?? null) as string | null,
    unit_price: (inv?.unit_price ?? p.unit_price ?? 0) as number,
    cost_price: (inv?.cost_price ?? p.cost_price ?? 0) as number,
    stock_quantity: (inv?.stock_quantity ?? p.stock_quantity ?? 0) as number,
    reserved_quantity: (inv?.reserved_quantity ?? p.reserved_quantity ?? 0) as number,
    min_stock: (inv?.min_stock ?? p.min_stock ?? 0) as number,
    max_stock: (inv?.max_stock ?? p.max_stock ?? null) as number | null,
    location: (inv?.location ?? p.location ?? null) as string | null,
    notes: (inv?.notes ?? p.notes ?? null) as string | null,
    active: (inv?.active ?? p.active ?? true) as boolean,
    category: (p.category as { name: string } | null) ?? null,
  };
}

export async function listProducts(businessId: string, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  const { data, error } = await supabase.rpc("auto_parts_list_products", {
    p_business_id: businessId,
    p_branch_id: branch,
  });
  if (error) throw error;
  
  const list = (data ?? []) as any[];
  // Keep only products that are configured by the business (having price)
  return list.filter((r) => r.unit_price !== null || r.cost_price !== null) as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function listProductsFull(businessId: string, sessionToken?: string | null, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);
  const { data, error } = await supabase.rpc("auto_parts_list_products_full", {
    p_business_id: businessId,
    p_session_token: sessionToken || null,
    p_branch_id: branch,
  });
  if (error) throw error;

  const list = (data ?? []) as any[];
  return list.filter((r) => r.unit_price !== null || r.cost_price !== null) as (AutoPartsProduct & { category: { name: string } | null })[];
}

export async function getProduct(id: string, businessId?: string) {
  // If businessId is provided, try the new inventory architecture first
  if (businessId) {
    const { data: invData } = await supabase
      .from("auto_parts_product_inventory")
      .select("*")
      .eq("product_id", id)
      .eq("business_id", businessId)
      .limit(1);
    
    const invRow = invData?.[0] || null;

    if (invRow) {
      const { data: prodData, error: prodError } = await supabase
        .from("auto_parts_products")
        .select("*, category:auto_parts_categories(name)")
        .eq("id", id)
        .limit(1);
      
      const prod = prodData?.[0] || null;
      if (prodError) throw prodError;
      if (prod) return mergeInventory(prod, invRow);
    }
  }

  // Fallback: old architecture or no businessId
  const { data, error } = await supabase
    .from("auto_parts_products")
    .select("*, category:auto_parts_categories(name)")
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  return (data?.[0] || null) as AutoPartsProduct & { category: { name: string } | null };
}

export async function createProduct(businessId: string, values: Partial<AutoPartsProduct>) {
  const branch = getBranch(businessId, values.branch_id);

  // Check if inventory table exists and is in use for this business
  const { data: invCheck } = await supabase
    .from("auto_parts_product_inventory")
    .select("id")
    .eq("business_id", businessId)
    .limit(1);

  const usingInventory = Array.isArray(invCheck) && invCheck.length > 0;

  if (usingInventory) {
    // New architecture: create global product + inventory row
    // 1. Insert product into global catalog (no business_id)
    const { data: prodData, error: prodError } = await supabase
      .from("auto_parts_products")
      .insert({
        name: values.name,
        description: values.description || null,
        category_id: values.category_id || null,
        sku: values.sku || null,
        barcode: values.barcode || null,
        notes: values.notes || null,
        image_url: values.image_url || null,
        active: values.active ?? true,
        business_id: null,
        branch_id: null,
        unit_price: null,
        cost_price: null,
        stock_quantity: 0,
        reserved_quantity: 0,
        min_stock: 0,
      })
      .select();
    if (prodError) throw prodError;
    const prod = prodData?.[0];
    if (!prod) throw new Error("Erreur lors de la création du produit");

    // 2. Create inventory row for this business
    const { error: invError } = await supabase
      .from("auto_parts_product_inventory")
      .insert({
        business_id: businessId,
        branch_id: branch ?? null,
        product_id: prod.id,
        unit_price: Number(values.unit_price) || 0,
        cost_price: Number(values.cost_price) || 0,
        stock_quantity: Number(values.stock_quantity) || 0,
        reserved_quantity: 0,
        min_stock: Number(values.min_stock) || 0,
        max_stock: values.max_stock ? Number(values.max_stock) : null,
        location: values.location || null,
        notes: values.notes || null,
        active: values.active ?? true,
      });
    if (invError) throw invError;

    return mergeInventory(prod, {
      business_id: businessId,
      branch_id: branch,
      unit_price: Number(values.unit_price) || 0,
      cost_price: Number(values.cost_price) || 0,
      stock_quantity: Number(values.stock_quantity) || 0,
      reserved_quantity: 0,
      min_stock: Number(values.min_stock) || 0,
      max_stock: values.max_stock ? Number(values.max_stock) : null,
      location: values.location || null,
      notes: values.notes || null,
      active: values.active ?? true,
    });
  }

  // Old architecture: insert directly with business_id
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
    .select();
  if (error) throw error;
  return await getProduct(data?.[0]?.id, businessId);
}

export async function updateProduct(id: string, values: Partial<AutoPartsProduct>, businessId?: string) {
  if (!businessId) throw new Error("businessId is required");
  const branch = getBranch(businessId, values.branch_id);

  // Check if inventory table is in use for this specific branch
  let invQuery = supabase
    .from("auto_parts_product_inventory")
    .select("id")
    .eq("product_id", id)
    .eq("business_id", businessId);

  if (branch) {
    invQuery = invQuery.eq("branch_id", branch);
  } else {
    invQuery = invQuery.is("branch_id", null);
  }

  const { data: invRows } = await invQuery.limit(1);
  const invRow = invRows?.[0] || null;

  if (invRow) {
    // Update product global fields (name, description, category)
    const { error: prodError } = await supabase
      .from("auto_parts_products")
      .update({
        name: values.name,
        description: values.description ?? null,
        category_id: values.category_id || null,
        sku: values.sku ?? null,
        barcode: values.barcode ?? null,
        image_url: values.image_url ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (prodError) throw prodError;

    // Update inventory (business-specific fields)
    const invUpdateData: any = {
      unit_price: values.unit_price === null ? null : (Number(values.unit_price) || 0),
      cost_price: values.cost_price === null ? null : (Number(values.cost_price) || 0),
      min_stock: Number(values.min_stock) || 0,
      max_stock: values.max_stock ? Number(values.max_stock) : null,
      location: values.location ?? null,
      notes: values.notes ?? null,
      active: values.active ?? true,
      updated_at: new Date().toISOString(),
    };
    
    // Only update stock_quantity if it was explicitly provided in values
    if (values.stock_quantity !== undefined) {
      invUpdateData.stock_quantity = Number(values.stock_quantity) || 0;
    }

    let invUpdate = supabase
      .from("auto_parts_product_inventory")
      .update(invUpdateData)
      .eq("product_id", id)
      .eq("business_id", businessId);

    if (branch) {
      invUpdate = invUpdate.eq("branch_id", branch);
    } else {
      invUpdate = invUpdate.is("branch_id", null);
    }

    const { error: invError } = await invUpdate;
    if (invError) throw invError;

    return await getProduct(id, businessId);
  }

  // No inventory row found. Check if product is a global product (new arch, business_id=null)
  // that was created without an inventory row. If so, create the inventory row now.
  const { data: globalProdData } = await supabase
    .from("auto_parts_products")
    .select("*, category:auto_parts_categories(name)")
    .eq("id", id)
    .is("business_id", null)
    .limit(1);
    
  const globalProd = globalProdData?.[0] || null;

  if (globalProd) {
    // Product is in the global catalog — create inventory row and update it
    const { error: invCreateError } = await supabase
      .from("auto_parts_product_inventory")
      .insert({
        business_id: businessId,
        branch_id: branch ?? null,
        product_id: id,
        unit_price: Number(values.unit_price) || 0,
        cost_price: Number(values.cost_price) || 0,
        stock_quantity: Number(values.stock_quantity) || 0,
        reserved_quantity: 0,
        min_stock: Number(values.min_stock) || 0,
        max_stock: values.max_stock ? Number(values.max_stock) : null,
        location: values.location ?? null,
        notes: values.notes ?? null,
        active: values.active ?? true,
      });
    if (invCreateError) throw invCreateError;

    // Also update the global product fields
    await supabase
      .from("auto_parts_products")
      .update({
        name: values.name,
        description: values.description ?? null,
        category_id: values.category_id || null,
        sku: values.sku ?? null,
        barcode: values.barcode ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return await getProduct(id, businessId);
  }

  // Old architecture: product has business_id set directly on the products table
  const payload: Record<string, unknown> = {
    ...values,
    unit_price: Number(values.unit_price) || 0,
    cost_price: Number(values.cost_price) || 0,
    min_stock: Number(values.min_stock) || 0,
    max_stock: values.max_stock ? Number(values.max_stock) : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("auto_parts_products")
    .update(payload)
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw error;
  return await getProduct(id, businessId);
}

export async function deleteProduct(id: string, businessId?: string) {
  if (!businessId) throw new Error("businessId is required");

  // Check if using inventory architecture
  const { data: invData } = await supabase
    .from("auto_parts_product_inventory")
    .select("id")
    .eq("product_id", id)
    .eq("business_id", businessId)
    .limit(1);
  const invRow = invData?.[0] || null;

  if (invRow) {
    // Soft-delete: deactivate in inventory only
    const { error } = await supabase
      .from("auto_parts_product_inventory")
      .update({ active: false })
      .eq("product_id", id)
      .eq("business_id", businessId);
    if (error) throw error;
    return;
  }

  // Old architecture: hard delete
  const { error } = await supabase
    .from("auto_parts_products")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw error;
}

export async function searchProducts(businessId: string, searchQuery: string, branchId?: string | null) {
  const branch = getBranch(businessId, branchId);

  // Try inventory-based first
  const { data: invData, error: invError } = await supabase
    .from("auto_parts_product_inventory")
    .select(`
      business_id, branch_id, product_id, unit_price, cost_price,
      stock_quantity, reserved_quantity, min_stock, active,
      product:auto_parts_products!inner(
        id, name, description, category_id, sku, barcode,
        image_url, created_at, updated_at,
        category:auto_parts_categories(name)
      )
    `)
    .eq("business_id", businessId)
    .ilike("product.name", `%${searchQuery}%`)
    .limit(50);

  if (!invError && invData && invData.length > 0) {
    return invData.map((r: any) => mergeInventory(r.product, r));
  }

  // Fallback
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
