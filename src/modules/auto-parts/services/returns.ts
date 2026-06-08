import { supabase } from "@/lib/supabase";

export interface AutoPartsReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export async function listReturns(businessId: string | null) {
  if (!businessId) return [];
  const { data, error } = await supabase.rpc("auto_parts_list_returns", { p_business_id: businessId });
  if (error) throw error;
  return data as any[];
}

export async function processReturn(businessId: string, saleId: string, items: AutoPartsReturnItem[], reason?: string) {
  const { data, error } = await supabase.rpc("process_auto_parts_return", {
    p_business_id: businessId,
    p_sale_id: saleId,
    p_items: JSON.parse(JSON.stringify(items)),
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as { success: boolean; error?: string; sale_id: string; refund_status: string };
}
