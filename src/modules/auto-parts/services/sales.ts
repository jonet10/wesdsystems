import { supabase } from "@/lib/supabase";
import type { AutoPartsSale, AutoPartsSaleItem } from "../types";

export async function listSales(businessId: string | null) {
  if (businessId) {
    const { data, error } = await supabase.rpc("auto_parts_list_sales", { p_business_id: businessId });
    if (error) throw error;
    return data as (AutoPartsSale & { items: AutoPartsSaleItem[] })[];
  }
  let query = supabase.from("auto_parts_sales").select("*, items:auto_parts_sale_items(*)");
  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data as (AutoPartsSale & { items: AutoPartsSaleItem[] })[];
}

export async function getSale(id: string) {
  const { data, error } = await supabase.rpc("auto_parts_get_sale", { p_id: id });
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
  items: { product_id?: string | null; product_name: string; quantity: number; unit_price: number }[];
}) {
  const items = sale.items.map((item) => ({
    product_id: item.product_id ?? null,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.quantity * item.unit_price,
  }));

  const { data, error } = await supabase.rpc("create_auto_parts_sale", {
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
  });
  if (error) throw error;
  return data as { id: string; invoice_number: string };
}
