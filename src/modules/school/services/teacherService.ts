import { supabase } from "@/lib/supabase";
import type { SchoolTeacher } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const teacherService = {
  async getAll() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_teachers")
      .select("*")
      .eq("business_id", businessId)
      .order("last_name", { ascending: true });
    if (error) throw error;
    return data as SchoolTeacher[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("school_teachers")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as SchoolTeacher;
  },

  async create(payload: Partial<SchoolTeacher>) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_teachers")
      .insert([{ ...payload, business_id: businessId }])
      .select()
      .single();
    if (error) throw error;
    return data as SchoolTeacher;
  },

  async update(id: string, payload: Partial<SchoolTeacher>) {
    const { data, error } = await supabase
      .from("school_teachers")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as SchoolTeacher;
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("school_teachers")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
};
