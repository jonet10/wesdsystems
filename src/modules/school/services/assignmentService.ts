import { supabase } from "@/lib/supabase";
import type { SchoolTeacherAssignment } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const assignmentService = {
  async getByTeacherId(teacherId: string) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_teacher_assignments")
      .select(`
        *,
        school_class:school_classes(*),
        subject:school_subjects(*)
      `)
      .eq("business_id", businessId)
      .eq("teacher_id", teacherId);
    if (error) throw error;
    return data as any[] as SchoolTeacherAssignment[];
  },

  async create(payload: Partial<SchoolTeacherAssignment>) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_teacher_assignments")
      .insert([{ ...payload, business_id: businessId }])
      .select(`
        *,
        school_class:school_classes(*),
        subject:school_subjects(*)
      `)
      .single();
    if (error) throw error;
    return data as any as SchoolTeacherAssignment;
  },

  async update(id: string, payload: Partial<SchoolTeacherAssignment>) {
    const { data, error } = await supabase
      .from("school_teacher_assignments")
      .update(payload)
      .eq("id", id)
      .select(`
        *,
        school_class:school_classes(*),
        subject:school_subjects(*)
      `)
      .single();
    if (error) throw error;
    return data as any as SchoolTeacherAssignment;
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("school_teacher_assignments")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async saveTeacherAssignments(teacherId: string, assignments: Array<{
    class_id: string;
    subject_id: string;
    pay_mode: 'hourly' | 'monthly';
    hourly_rate: number;
    hours_per_week: number;
    monthly_salary: number;
  }>) {
    const businessId = getBusinessId();

    // Delete current assignments for the teacher
    const { error: deleteError } = await supabase
      .from("school_teacher_assignments")
      .delete()
      .eq("teacher_id", teacherId);
    if (deleteError) throw deleteError;

    if (assignments.length === 0) return [];

    // Insert new ones
    const payloads = assignments.map(a => ({
      business_id: businessId,
      teacher_id: teacherId,
      class_id: a.class_id,
      subject_id: a.subject_id,
      pay_mode: a.pay_mode,
      hourly_rate: a.hourly_rate,
      hours_per_week: a.hours_per_week,
      monthly_salary: a.monthly_salary,
      currency: 'HTG'
    }));

    const { data, error: insertError } = await supabase
      .from("school_teacher_assignments")
      .insert(payloads)
      .select(`
        *,
        school_class:school_classes(*),
        subject:school_subjects(*)
      `);

    if (insertError) throw insertError;
    return data as any[] as SchoolTeacherAssignment[];
  }
};
