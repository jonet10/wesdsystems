import { supabase } from "@/lib/supabase";
import type { PharmacyProduct, PharmacyCategory, PharmacyProductUnit } from "../types";

let currentBusinessId: string | null = null;

export const setPharmacyBusinessId = (id: string) => {
  currentBusinessId = id;
};

export const getPharmacyBusinessId = () => {
  if (!currentBusinessId) throw new Error("Business ID not set for Pharmacy Module");
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

  async createCategory(payload: Partial<PharmacyCategory>) {
    const businessId = getPharmacyBusinessId();
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

  async createProduct(payload: Partial<PharmacyProduct>) {
    const businessId = getPharmacyBusinessId();
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

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from("pharmacy_products")
      .update({ active: false }) // Soft delete
      .eq("id", id);
      
    if (error) throw error;
  },

  async getProductUnits(productId: string) {
    const businessId = getPharmacyBusinessId();
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
