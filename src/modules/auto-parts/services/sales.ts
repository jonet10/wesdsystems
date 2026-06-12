import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";
import type { AutoPartsSale, AutoPartsSaleItem } from "../types";

export async function listSales(businessId: string, branchId?: string | null) {
  const params: Record<string, any> = { p_business_id: businessId };
  if (branchId) params.p_branch_id = branchId;
  const { data, error } = await supabase.rpc("auto_parts_list_sales", params);
  if (error) throw error;
  return data as (AutoPartsSale & { items: AutoPartsSaleItem[] })[];
}

export async function getSale(id: string, businessId?: string) {
  const { data, error } = await supabase.rpc("auto_parts_get_sale", { p_id: id, p_business_id: businessId ?? null });
  if (error) throw error;
  return data as AutoPartsSale & { items: AutoPartsSaleItem[] };
}

export async function createSale(businessId: string, sale: {
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  client_id?: string | null;
  client_name?: string;
  staff_id?: string | null;
  notes?: string;
  branch_id?: string | null;
  items: { product_id?: string | null; product_name: string; quantity: number; unit_price: number }[];
}) {
  const items = sale.items.map((item) => ({
    product_id: item.product_id ?? null,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.quantity * item.unit_price,
  }));

  const params: Record<string, any> = {
    p_business_id: businessId,
    p_client_id: sale.client_id ?? null,
    p_client_name: sale.client_name ?? null,
    p_subtotal: sale.subtotal,
    p_tax_rate: sale.tax_rate,
    p_tax_amount: sale.tax_amount,
    p_discount_type: sale.discount_type,
    p_discount_value: sale.discount_value,
    p_discount_amount: sale.discount_amount,
    p_total: sale.total,
    p_payment_method: sale.payment_method,
    p_payment_status: sale.payment_status,
    p_notes: sale.notes ?? null,
    p_staff_id: sale.staff_id ?? null,
    p_items: JSON.parse(JSON.stringify(items)),
  };
  const branch = sale.branch_id ?? getStoredBranchId(businessId);
  if (branch) params.p_branch_id = branch;
  const { data, error } = await supabase.rpc("create_auto_parts_sale", params);
  if (error) {
    if (error.message?.startsWith("STOCK_INSUFFICIENT_")) {
      throw new Error(error.hint || "Stock insuffisant");
    }
    throw error;
  }
  return data as { id: string; invoice_number: string };
}
