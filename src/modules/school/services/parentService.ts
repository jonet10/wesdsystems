import { supabase } from "@/lib/supabase";
import type { SchoolParent } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const parentService = {
  async getAll() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_parents")
      .select("*")
      .eq("business_id", businessId)
      .order("last_name", { ascending: true });
    if (error) throw error;
    return data as SchoolParent[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("school_parents")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as SchoolParent;
  },

  async create(payload: Partial<SchoolParent>) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_parents")
      .insert([{ ...payload, business_id: businessId }])
      .select()
      .single();
    if (error) throw error;
    return data as SchoolParent;
  },

  async update(id: string, payload: Partial<SchoolParent>) {
    const { data, error } = await supabase
      .from("school_parents")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as SchoolParent;
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("school_parents")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async getStats() {
    const businessId = getBusinessId();
    const { count } = await supabase
      .from("school_parents")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId);
    return count || 0;
  }
};
