import { supabase } from "@/lib/supabase";
import type { AutoPartsStockMovement } from "../types";

export async function listStockMovements(businessId: string) {
  const { data, error } = await supabase.rpc("auto_parts_list_stock_movements", { p_business_id: businessId });
  if (error) throw error;
  return data as (AutoPartsStockMovement & { product: { name: string } })[];
}

export async function createStockMovement(businessId: string, values: {
  product_id: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  unit_price?: number | null;
  reference?: string;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc("record_auto_parts_stock_movement", {
    p_business_id: businessId,
    p_product_id: values.product_id,
    p_type: values.type,
    p_quantity: values.quantity,
    p_unit_price: values.unit_price ?? null,
    p_reference: values.reference ?? null,
    p_notes: values.notes ?? null,
  });
  if (error) throw error;
  return data;
}
