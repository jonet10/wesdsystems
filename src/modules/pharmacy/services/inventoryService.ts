import { supabase } from "@/lib/supabase";
import type { PharmacySupplier, PharmacyPurchase, PharmacyPurchaseItem, PharmacyBatch, PharmacyStockMovement } from "../types";
import { getPharmacyBusinessId } from "./productService";

export const inventoryService = {
  // --- SUPPLIERS ---
  async getSuppliers() {
    const businessId = getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_suppliers")
      .select("*")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data as PharmacySupplier[];
  },

  async createSupplier(payload: Partial<PharmacySupplier>) {
    const businessId = getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_suppliers")
      .insert([{ ...payload, business_id: businessId }])
      .select()
      .single();
    if (error) throw error;
    return data as PharmacySupplier;
  },

  async updateSupplier(id: string, payload: Partial<PharmacySupplier>) {
    const { data, error } = await supabase
      .from("pharmacy_suppliers")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as PharmacySupplier;
  },

  async deleteSupplier(id: string) {
    const { error } = await supabase
      .from("pharmacy_suppliers")
      .update({ active: false }) // Soft delete
      .eq("id", id);
    if (error) throw error;
  },

  // --- PURCHASES ---
  async getPurchases() {
    const businessId = getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_purchases")
      .select("*, supplier:supplier_id(*)")
      .eq("business_id", businessId)
      .order("purchase_date", { ascending: false });
    if (error) throw error;
    return data as PharmacyPurchase[];
  },

  // Note: Complex purchase logic (with items and batches) should be handled via a Supabase RPC function for atomicity in production,
  // but for the frontend implementation we'll simulate the inserts sequentially.
  async createPurchase(purchase: Partial<PharmacyPurchase>, items: any[]) {
    const businessId = getPharmacyBusinessId();
    
    // 1. Create Purchase
    const { data: newPurchase, error: purchaseErr } = await supabase
      .from("pharmacy_purchases")
      .insert([{ ...purchase, business_id: businessId }])
      .select()
      .single();
    if (purchaseErr) throw purchaseErr;

    // 2. Process Items
    for (const item of items) {
      // Create Batch for each item
      const { data: batch, error: batchErr } = await supabase
        .from("pharmacy_batches")
        .insert([{
          business_id: businessId,
          product_id: item.product_id,
          purchase_id: newPurchase.id,
          batch_number: item.batch_number,
          expiration_date: item.expiration_date,
          initial_quantity: item.quantity,
          current_quantity: item.quantity,
          cost_price: item.cost_price,
          sale_price: item.sale_price
        }])
        .select()
        .single();
      
      if (batchErr) throw batchErr;

      // Create Purchase Item
      const { error: itemErr } = await supabase
        .from("pharmacy_purchase_items")
        .insert([{
          business_id: businessId,
          purchase_id: newPurchase.id,
          product_id: item.product_id,
          batch_id: batch.id,
          quantity: item.quantity,
          unit_price: item.cost_price,
          total_price: item.quantity * item.cost_price
        }]);

      if (itemErr) throw itemErr;

      // Create Stock Movement (In)
      await supabase
        .from("pharmacy_stock_movements")
        .insert([{
          business_id: businessId,
          product_id: item.product_id,
          batch_id: batch.id,
          type: "in",
          quantity: item.quantity,
          reference: `Purchase ${newPurchase.purchase_number}`
        }]);
    }

    return newPurchase;
  },

  // --- BATCHES ---
  async getBatches() {
    const businessId = getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_batches")
      .select("*, product:product_id(name, min_stock_alert)")
      .eq("business_id", businessId)
      .order("expiration_date", { ascending: true }); // FEFO ordering
    if (error) throw error;
    return data as PharmacyBatch[];
  }
};
