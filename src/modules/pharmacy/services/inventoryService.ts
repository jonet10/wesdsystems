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

  async createBatch(payload: Partial<PharmacyBatch>, explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    
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

  async createStockMovement(movement: Partial<PharmacyStockMovement>, explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    
    // 1. Resolve or create Batch if not specified
    let batchId = movement.batch_id;
    if (!batchId && movement.product_id) {
      // Find the first active batch for this product
      const { data: existingBatches } = await supabase
        .from("pharmacy_batches")
        .select("id")
        .eq("product_id", movement.product_id)
        .gt("current_quantity", 0)
        .order("expiration_date", { ascending: true })
        .limit(1);
        
      if (existingBatches && existingBatches.length > 0) {
        batchId = existingBatches[0].id;
      } else {
        // Fetch product's default prices
        const { data: prod } = await supabase
          .from("pharmacy_products")
          .select("cost_price, sale_price")
          .eq("id", movement.product_id)
          .single();

        const expDate = new Date();
        expDate.setFullYear(expDate.getFullYear() + 1); // 1 year from now
        
        const { data: newBatch, error: newBatchErr } = await supabase
          .from("pharmacy_batches")
          .insert([{
            business_id: businessId,
            product_id: movement.product_id,
            batch_number: "LOT-AUTO",
            expiration_date: expDate.toISOString().split("T")[0],
            initial_quantity: movement.quantity || 0,
            current_quantity: movement.quantity || 0,
            cost_price: prod?.cost_price || 0,
            sale_price: prod?.sale_price || 0
          }])
          .select()
          .single();
          
        if (newBatchErr) throw newBatchErr;
        if (newBatch) {
          batchId = newBatch.id;
        }
      }
    }

    // 2. Insert Stock Movement
    const { data: newMovement, error: moveErr } = await supabase
      .from("pharmacy_stock_movements")
      .insert([{
        ...movement,
        batch_id: batchId || null,
        business_id: businessId
      }])
      .select()
      .single();

    if (moveErr) throw moveErr;

    // 3. Update batch quantity
    if (batchId && movement.quantity) {
      const { data: batch, error: getErr } = await supabase
        .from("pharmacy_batches")
        .select("current_quantity, created_at")
        .eq("id", batchId)
        .single();
        
      if (!getErr && batch) {
        const wasJustCreated = (new Date().getTime() - new Date(batch.created_at).getTime()) < 2000;
        let newQty = Number(batch.current_quantity);
        
        if (wasJustCreated) {
          if (!(movement.type === "in" || movement.type === "return" || movement.type === "adjustment")) {
            newQty = 0;
          }
        } else {
          if (movement.type === "in" || movement.type === "return" || movement.type === "adjustment") {
            newQty += Number(movement.quantity);
          } else {
            newQty -= Number(movement.quantity);
          }
        }
        
        await supabase
          .from("pharmacy_batches")
          .update({ current_quantity: Math.max(0, newQty) })
          .eq("id", batchId);
      }
    }
    
    return newMovement;
  }
};
