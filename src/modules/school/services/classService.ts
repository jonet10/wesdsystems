import { supabase } from "@/lib/supabase";
import type { SchoolClass } from "@/modules/school/types";
import { DEFAULT_CLASSES, type DefaultClass } from "@/modules/school/defaultClasses";
import { getBusinessId } from "./utils";

export const classService = {
  async getAll(includeInactive = false) {
    const businessId = getBusinessId();
    let query = supabase
      .from("school_classes")
      .select("*")
      .eq("business_id", businessId)
      .order("level_order", { ascending: true })
      .order("name", { ascending: true });
    if (!includeInactive) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) {
      if (!includeInactive) {
        const { data: fallback, error: fallbackErr } = await supabase
          .from("school_classes")
          .select("*")
          .eq("business_id", businessId)
          .order("level_order", { ascending: true })
          .order("name", { ascending: true });
        if (fallbackErr) throw fallbackErr;
        return (fallback || []) as SchoolClass[];
      }
      throw error;
    }
    return data as SchoolClass[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("school_classes")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as SchoolClass;
  },

  async create(payload: Partial<SchoolClass>) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_classes")
      .insert([{ ...payload, business_id: businessId, active: true }])
      .select()
      .single();
    if (error) throw error;
    return data as SchoolClass;
  },

  async update(id: string, payload: Partial<SchoolClass>) {
    const { data, error } = await supabase
      .from("school_classes")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as SchoolClass;
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("school_classes")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async toggleActive(id: string, active: boolean) {
    const { error } = await supabase
      .from("school_classes")
      .update({ active })
      .eq("id", id);
    if (error) {
      const isMissingColumn = error.message?.includes("active") || error.code === "42703";
      if (isMissingColumn) throw new Error("La colonne 'active' n'existe pas encore. Exécutez la migration SQL fournie par l'équipe technique.");
      throw error;
    }
  },

  async seedDefaultClasses(businessId: string) {
    const { data: existing } = await supabase
      .from("school_classes")
      .select("id")
      .eq("business_id", businessId)
      .limit(1);
    if (existing && existing.length > 0) return [];

    const payloads = DEFAULT_CLASSES.map((c: DefaultClass) => ({
      business_id: businessId,
      code: c.code,
      name: c.name,
      cycle: c.cycle,
      level_order: c.level_order,
      section: null,
      max_students: null,
      active: true,
    }));

    const { data, error } = await supabase
      .from("school_classes")
      .insert(payloads)
      .select();
    if (error) throw error;
    return data as SchoolClass[];
  },
};
