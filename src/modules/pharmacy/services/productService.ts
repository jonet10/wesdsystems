import { supabase } from "@/lib/supabase";
import { glowupStore } from "@/lib/store";
import type { PharmacyProduct, PharmacyCategory, PharmacyProductUnit } from "../types";

let currentBusinessId: string | null = null;

export const setPharmacyBusinessId = (id: string | null) => {
  currentBusinessId = id;
};

export const DEFAULT_PHARMACY_BUSINESS_ID = "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

export const getPharmacyBusinessId = (): string => {
  if (currentBusinessId) return currentBusinessId;

  if (typeof window !== "undefined") {
    const localPharmBiz = localStorage.getItem("pharmacy_business_id");
    if (localPharmBiz) {
      currentBusinessId = localPharmBiz;
      return currentBusinessId;
    }
    const localBiz = localStorage.getItem("glowup_business_id");
    if (localBiz) {
      currentBusinessId = localBiz;
      return currentBusinessId;
    }
  }

  // Auto-resolve fallback from store / localStorage
  const fallbackSalon = glowupStore.getSalons()[0]?.business_id;
  if (fallbackSalon) {
    currentBusinessId = fallbackSalon;
    return currentBusinessId;
  }

  currentBusinessId = DEFAULT_PHARMACY_BUSINESS_ID;
  return currentBusinessId;
};

export const productService = {
  async getCategories(explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_categories")
      .select("*")
      .eq("business_id", businessId)
      .order("name");
    
    if (error) throw error;
    return data as PharmacyCategory[];
  },

  async createCategory(payload: Partial<PharmacyCategory>, explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_categories")
      .insert([{ ...payload, business_id: businessId }])
      .select()
      .single();
      
    if (error) throw error;
    return data as PharmacyCategory;
  },


  async updateCategory(id: string, payload: Partial<PharmacyCategory>) {
    const { data, error } = await supabase
      .from("pharmacy_categories")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
      
    if (error) throw error;
    return data as PharmacyCategory;
  },

  async deleteCategory(id: string) {
    const { error } = await supabase
      .from("pharmacy_categories")
      .delete()
      .eq("id", id);
      
    if (error) throw error;
  },

  async getProducts(explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_products")
      .select("*, category:category_id(*)")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name");
      
    if (error) throw error;
    return data as PharmacyProduct[];
  },

  async createProduct(payload: Partial<PharmacyProduct>, explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_products")
      .insert([{ ...payload, business_id: businessId }])
      .select()
      .single();
      
    if (error) throw error;
    return data as PharmacyProduct;
  },

  async updateProduct(id: string, payload: Partial<PharmacyProduct>) {
    const { data, error } = await supabase
      .from("pharmacy_products")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
      
    if (error) throw error;
    return data as PharmacyProduct;
  },

  async updateBulkPrices(updates: { id: string; sale_price: number }[]) {
    if (updates.length === 0) return;
    const batchSize = 25;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((item) =>
          supabase
            .from("pharmacy_products")
            .update({ sale_price: item.sale_price })
            .eq("id", item.id)
        )
      );
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    }
  },

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from("pharmacy_products")
      .update({ active: false }) // Soft delete
      .eq("id", id);
      
    if (error) throw error;
  },

  async getProductUnits(productId: string, explicitBusinessId?: string) {
    const businessId = explicitBusinessId || getPharmacyBusinessId();
    const { data, error } = await supabase
      .from("pharmacy_product_units")
      .select("*")
      .eq("business_id", businessId)
      .eq("product_id", productId)
      .order("conversion_factor", { ascending: false });
      
    if (error) throw error;
    return data as PharmacyProductUnit[];
  },

  async importStandardCatalog(businessId: string) {
    const { data, error } = await supabase
      .rpc("import_standard_pharmacy_catalog", { p_business_id: businessId });
    if (error) throw error;
    return data;
  }
};
