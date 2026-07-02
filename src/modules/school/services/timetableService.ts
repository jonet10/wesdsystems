import { supabase } from "@/lib/supabase";
import { getBusinessId } from "./utils";

export interface SchoolTimetableSlot {
  id?: string;
  business_id: string;
  branch_id?: string | null;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number; // 1-7
  start_time: string; // e.g. "08:00:00"
  end_time: string; // e.g. "10:00:00"
  classroom?: string | null;
  created_at?: string;
  
  // Relations
  class?: { name: string; section?: string | null };
  subject?: { name: string };
  teacher?: { first_name: string; last_name: string };
}

export const timetableService = {
  async getByClass(classId: string): Promise<SchoolTimetableSlot[]> {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_timetables")
      .select("*, class:school_classes(name, section), subject:school_subjects(name), teacher:school_teachers(first_name, last_name)")
      .eq("business_id", businessId)
      .eq("class_id", classId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) throw error;
    return data as any[];
  },

  async create(payload: Partial<SchoolTimetableSlot>): Promise<SchoolTimetableSlot> {
    const businessId = getBusinessId();
    
    // Check conflicts (Vite will handle it or we can let Supabase throw unique constraint, but a pre-check is nice)
    const { data, error } = await supabase
      .from("school_timetables")
      .insert([{ ...payload, business_id: businessId }])
      .select("*, class:school_classes(name, section), subject:school_subjects(name), teacher:school_teachers(first_name, last_name)")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Conflit de planification : L'enseignant, la classe ou la salle est déjà occupé à ce créneau horaire.");
      }
      throw error;
    }
    return data as any;
  },

  async update(id: string, payload: Partial<SchoolTimetableSlot>): Promise<SchoolTimetableSlot> {
    const { data, error } = await supabase
      .from("school_timetables")
      .update(payload)
      .eq("id", id)
      .select("*, class:school_classes(name, section), subject:school_subjects(name), teacher:school_teachers(first_name, last_name)")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Conflit de planification : L'enseignant, la classe ou la salle est déjà occupé à ce créneau horaire.");
      }
      throw error;
    }
    return data as any;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("school_timetables")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
};
