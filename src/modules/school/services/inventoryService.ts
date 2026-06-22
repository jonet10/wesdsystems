import { supabase } from "@/lib/supabase";
import type { SchoolProduct, SchoolStockMovement } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const inventoryService = {
  // Products
  async getProducts() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_products")
      .select("*")
      .eq("business_id", businessId)
      .order("name");
    
    if (error) throw error;
    return data as SchoolProduct[];
  },

  async addProduct(product: Partial<SchoolProduct>) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_products")
      .insert([{ ...product, business_id: businessId }])
      .select()
      .single();
      
    if (error) throw error;
    return data as SchoolProduct;
  },

  async updateProduct(id: string, updates: Partial<SchoolProduct>) {
    const { data, error } = await supabase
      .from("school_products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
      
    if (error) throw error;
    return data as SchoolProduct;
  },

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from("school_products")
      .delete()
      .eq("id", id);
      
    if (error) throw error;
  },

  // Stock Movements
  async addStockMovement(movement: Partial<SchoolStockMovement>) {
    const businessId = getBusinessId();
    
    // Get current stock
    const { data: product } = await supabase
      .from("school_products")
      .select("stock_quantity")
      .eq("id", movement.product_id)
      .single();
      
    const currentStock = product?.stock_quantity || 0;
    
    // Calculate new stock
    let newStock = currentStock;
    if (movement.movement_type === 'ENTREE' || movement.movement_type === 'RETOUR') {
      newStock += (movement.quantity || 0);
    } else if (movement.movement_type === 'SORTIE' || movement.movement_type === 'VENTE') {
      newStock -= (movement.quantity || 0);
    } else if (movement.movement_type === 'AJUSTEMENT') {
      // Pour l'ajustement, la quantité envoyée est le nouveau stock absolu
      newStock = movement.quantity || 0;
      movement.quantity = Math.abs(newStock - currentStock); // On garde la différence pour l'historique
    }

    // Update product stock
    await supabase
      .from("school_products")
      .update({ stock_quantity: newStock })
      .eq("id", movement.product_id);

    // Record movement
    const { data, error } = await supabase
      .from("school_stock_movements")
      .insert([{
        ...movement,
        business_id: businessId,
        previous_stock: currentStock,
        new_stock: newStock
      }])
      .select()
      .single();
      
    if (error) throw error;
    return data as SchoolStockMovement;
  },

  async getStockMovements(productId: string) {
    const { data, error } = await supabase
      .from("school_stock_movements")
      .select("*, product:product_id(*)")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
      
    if (error) throw error;
    return data as SchoolStockMovement[];
  }
};
