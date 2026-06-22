import { supabase } from "@/lib/supabase";
import type { SchoolSale, SchoolSaleItem, SchoolProduct } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const posService = {
  async processSale(params: {
    student_id?: string;
    customer_name?: string;
    items: { product_id: string; quantity: number; unit_price: number }[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    payment_method: string;
    created_by?: string;
  }) {
    const businessId = getBusinessId();
    
    // Generer un numero de recu (on reutilise generate_school_receipt_number ou un UUID court)
    const receipt_number = `VTE-${Math.floor(Date.now() / 1000)}`;

    // 1. Create Sale
    const { data: sale, error: saleError } = await supabase
      .from("school_sales")
      .insert([{
        business_id: businessId,
        receipt_number,
        student_id: params.student_id || null,
        customer_name: params.customer_name || null,
        subtotal: params.subtotal,
        discount: params.discount,
        tax: params.tax,
        total: params.total,
        payment_method: params.payment_method,
        created_by: params.created_by
      }])
      .select()
      .single();

    if (saleError) throw saleError;

    // 2. Create Items
    const itemsPayload = params.items.map(item => ({
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price
    }));

    const { error: itemsError } = await supabase
      .from("school_sale_items")
      .insert(itemsPayload);

    if (itemsError) throw itemsError;

    // 3. Deduct Stock & Record Movements
    for (const item of params.items) {
      // Get current stock
      const { data: product } = await supabase
        .from("school_products")
        .select("stock_quantity")
        .eq("id", item.product_id)
        .single();
        
      const currentStock = product?.stock_quantity || 0;
      const newStock = currentStock - item.quantity;

      // Update product stock
      await supabase
        .from("school_products")
        .update({ stock_quantity: newStock })
        .eq("id", item.product_id);

      // Record movement
      await supabase
        .from("school_stock_movements")
        .insert([{
          business_id: businessId,
          product_id: item.product_id,
          movement_type: 'VENTE',
          quantity: item.quantity,
          previous_stock: currentStock,
          new_stock: newStock,
          reference_id: sale.id,
          notes: "Vente POS Scolaire"
        }]);
    }

    // 4. Return full sale for receipt
    const { data: fullSale, error: fetchError } = await supabase
      .from("school_sales")
      .select("*, items:school_sale_items(*, product:product_id(*))")
      .eq("id", sale.id)
      .single();

    if (fetchError) throw fetchError;
    return fullSale as SchoolSale;
  },

  async getSales(limit = 50) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_sales")
      .select("*, items:school_sale_items(*, product:product_id(*))")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as SchoolSale[];
  }
};
