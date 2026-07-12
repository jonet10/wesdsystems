import { supabase } from "@/lib/supabase";

export interface StationeryPurchase {
  id: string;
  business_id: string;
  branch_id: string | null;
  supplier_id: string | null;
  purchase_date: string;
  invoice_number: string | null;
  total_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  supplier?: { company_name: string; contact_name: string; phone: string };
}

export async function listPurchases(businessId: string, branchId: string | null) {
  let query = supabase
    .from("stationery_purchases")
    .select("*, supplier:supplier_id(company_name, contact_name, phone)")
    .eq("business_id", businessId)
    .order("purchase_date", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as StationeryPurchase[];
}

export async function createPurchase(
  businessId: string,
  branchId: string | null,
  purchaseData: any,
  items: any[]
) {
  // Insert Purchase
  const { data: purchase, error: purchaseError } = await supabase
    .from("stationery_purchases")
    .insert({
      business_id: businessId,
      branch_id: branchId || null,
      ...purchaseData
    })
    .select()
    .single();

  if (purchaseError) throw purchaseError;

  // Insert Items
  const purchaseItems = items.map(item => ({
    purchase_id: purchase.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_cost: item.unit_cost,
    total_cost: item.quantity * item.unit_cost
  }));

  const { error: itemsError } = await supabase
    .from("stationery_purchase_items")
    .insert(purchaseItems);

  if (itemsError) throw itemsError;

  // Update Stock (Optimistic basic update for the UI without relying on RPC)
  for (const item of items) {
    const { data: prod } = await supabase
      .from("stationery_products")
      .select("stock_quantity")
      .eq("id", item.product_id)
      .single();
      
    if (prod) {
      await supabase
        .from("stationery_products")
        .update({ stock_quantity: prod.stock_quantity + item.quantity })
        .eq("id", item.product_id);
    }
  }

  return purchase;
}
