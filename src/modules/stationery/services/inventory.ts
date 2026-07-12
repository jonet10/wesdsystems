import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";

export async function listInventoryAdjustments(businessId: string, branchId?: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  const { data, error } = await supabase
    .from("stationery_inventory_adjustments")
    .select(`
      id,
      adjustment_date,
      type,
      quantity,
      reason,
      notes,
      stationery_products ( id, name, sku, barcode )
    `)
    .eq("business_id", businessId)
    .eq("branch_id", finalBranchId)
    .order("adjustment_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createInventoryAdjustment(
  businessId: string,
  branchId: string,
  adjustmentData: {
    product_id: string;
    type: 'add' | 'remove' | 'set';
    quantity: number;
    reason: string;
    notes?: string;
  }
) {
  const finalBranchId = branchId || getStoredBranchId(businessId);

  // Since RPC might not be implemented, we will handle this directly or rely on UI logic.
  // Ideally, this calls an RPC like 'adjust_stationery_stock' that updates the product and logs movement.
  // For the frontend demo, we insert the adjustment log.
  
  const { data, error } = await supabase
    .from("stationery_inventory_adjustments")
    .insert({
      ...adjustmentData,
      business_id: businessId,
      branch_id: finalBranchId
    })
    .select()
    .single();

  if (error) throw error;

  // We should also update the stock_quantity in stationery_products.
  // We'll fetch current, compute new, and update.
  const { data: prod } = await supabase.from("stationery_products").select("stock_quantity").eq("id", adjustmentData.product_id).single();
  
  if (prod) {
    let newQty = prod.stock_quantity;
    if (adjustmentData.type === 'add') newQty += adjustmentData.quantity;
    if (adjustmentData.type === 'remove') newQty = Math.max(0, newQty - adjustmentData.quantity);
    if (adjustmentData.type === 'set') newQty = adjustmentData.quantity;

    await supabase.from("stationery_products").update({ stock_quantity: newQty }).eq("id", adjustmentData.product_id);
  }

  return data;
}
