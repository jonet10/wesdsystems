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
  async getBatches(explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_batches")
      .select("*, product:product_id(name, min_stock_alert)")
      .eq("business_id", businessId)
      .order("expiration_date", { ascending: true }); // FEFO ordering
    if (error) throw error;
    return data as PharmacyBatch[];
  },

  async createBatch(payload: Partial<PharmacyBatch>) {
    const businessId = getPharmacyBusinessId();
    
    // 1. Insert Batch
    const { data: batch, error: batchErr } = await supabase
      .from("pharmacy_batches")
      .insert([{
        ...payload,
        business_id: businessId,
        current_quantity: payload.initial_quantity // current starts equal to initial
      }])
      .select()
      .single();
      
    if (batchErr) throw batchErr;

    // 2. Log Stock Movement
    const { error: moveErr } = await supabase
      .from("pharmacy_stock_movements")
      .insert([{
        business_id: businessId,
        product_id: batch.product_id,
        batch_id: batch.id,
        type: "in",
        quantity: batch.initial_quantity,
        reference: `Lot initial : ${batch.batch_number}`
      }]);

    if (moveErr) console.error("Error creating stock movement for batch:", moveErr);

    return batch as PharmacyBatch;
  },

  async createStockMovement(movement: Partial<PharmacyStockMovement>) {
    const businessId = getPharmacyBusinessId();
    
    // 1. Insert Stock Movement
    const { data: newMovement, error: moveErr } = await supabase
      .from("pharmacy_stock_movements")
      .insert([{ ...movement, business_id: businessId }])
      .select()
      .single();

    if (moveErr) throw moveErr;

    // 2. If a batch is specified, update the batch's current quantity!
    if (movement.batch_id && movement.quantity) {
      // Get current batch quantity
      const { data: batch, error: getErr } = await supabase
        .from("pharmacy_batches")
        .select("current_quantity")
        .eq("id", movement.batch_id)
        .single();
        
      if (!getErr && batch) {
        let newQty = Number(batch.current_quantity);
        if (movement.type === "in" || movement.type === "return" || movement.type === "adjustment") {
          newQty += Number(movement.quantity);
        } else {
          newQty -= Number(movement.quantity);
        }
        
        // Update batch quantity
        await supabase
          .from("pharmacy_batches")
          .update({ current_quantity: Math.max(0, newQty) })
          .eq("id", movement.batch_id);
      }
    }
    
    return newMovement;
  }
};
