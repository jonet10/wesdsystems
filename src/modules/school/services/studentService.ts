import { supabase } from "@/lib/supabase";
import type { SchoolStudent } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const studentService = {
  async getAll() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_students")
      .select("*")
      .eq("business_id", businessId)
      .order("last_name", { ascending: true });
    if (error) throw error;
    return data as SchoolStudent[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("school_students")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as SchoolStudent;
  },

  async create(payload: Partial<SchoolStudent>) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_students")
      .insert([{ ...payload, business_id: businessId }])
      .select()
      .single();
    if (error) throw error;
    return data as SchoolStudent;
  },

  async update(id: string, payload: Partial<SchoolStudent>) {
    const { data, error } = await supabase
      .from("school_students")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as SchoolStudent;
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("school_students")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async getStats() {
    const businessId = getBusinessId();
    const { count } = await supabase
      .from("school_students")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId);
    return count || 0;
  }
};
