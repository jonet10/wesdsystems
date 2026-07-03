import { supabase } from "@/lib/supabase";
import type { SchoolSubject } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const subjectService = {
  async getAll() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_subjects")
      .select("*, school_subject_classes(class_id)")
      .eq("business_id", businessId)
      .order("name", { ascending: true });
    if (error) throw error;
    return data as SchoolSubject[];
  },

  async create(name: string) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_subjects")
      .insert([{ name, business_id: businessId }])
      .select()
      .single();
    if (error) throw error;
    return data as SchoolSubject;
  },

  async findOrCreate(name: string) {
    if (!name.trim()) throw new Error("Le nom de la matière ne peut pas être vide");
    const businessId = getBusinessId();
    
    // Check if it exists
    const { data: existing, error: findError } = await supabase
      .from("school_subjects")
      .select("*")
      .eq("business_id", businessId)
      .ilike("name", name.trim())
      .maybeSingle();

    if (findError) throw findError;
    if (existing) return existing as SchoolSubject;

    return this.create(name.trim());
  }
};
