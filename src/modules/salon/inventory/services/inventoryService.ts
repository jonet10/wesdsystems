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

export async function listLowStockProducts(businessId: string) {
  const { data, error } = await supabase
    .from("salon_products")
    .select("id, name, quantity_in_stock, reorder_level")
    .eq("business_id", businessId);

  if (error) throw new Error(error.message);
  return (data ?? []).filter((product) => Number(product.quantity_in_stock || 0) <= Number(product.reorder_level || 0));
}
