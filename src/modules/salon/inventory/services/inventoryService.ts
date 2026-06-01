import { supabase } from "@/lib/supabase";
import type { StockMovementInput } from "../types";

export async function recordStockMovement(input: StockMovementInput) {
  const { data, error } = await supabase
    .from("salon_stock_movements")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listLowStockProducts(branchId: string) {
  const { data, error } = await supabase
    .from("salon_products")
    .select("id, name, quantity_in_stock, reorder_level")
    .eq("branch_id", branchId);

  if (error) throw new Error(error.message);
  return (data ?? []).filter((product) => Number(product.quantity_in_stock || 0) <= Number(product.reorder_level || 0));
}

export async function listStockMovements(branchId: string, limit = 50) {
  const { data, error } = await supabase
    .from("salon_stock_movements")
    .select("id, product_id, movement_type, quantity_delta, quantity_before, quantity_after, reason, reference_type, reference_id, created_at")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}
