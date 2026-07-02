import { supabase } from "@/lib/supabase";
import { getBusinessId } from "./utils";

export interface SchoolAttendanceRecord {
  id?: string;
  business_id: string;
  branch_id?: string | null;
  date: string;
  type: 'student' | 'teacher';
  person_id: string; // student_id or teacher_id
  class_id?: string | null;
  status: 'present' | 'absent' | 'late' | 'excused';
  hours_missed?: number;
  note?: string | null;
  created_at?: string;
}

export const attendanceService = {
  /** Get all attendance records for a class on a specific date */
  async getByClassAndDate(classId: string, date: string): Promise<SchoolAttendanceRecord[]> {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_attendance")
      .select("*")
      .eq("business_id", businessId)
      .eq("class_id", classId)
      .eq("date", date)
      .eq("type", "student");

    if (error) throw error;
    return data as SchoolAttendanceRecord[];
  },

  /** Save attendance sheet for a class on a specific date */
  async save(classId: string, date: string, records: Array<{
    student_id: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    note?: string | null;
  }>): Promise<SchoolAttendanceRecord[]> {
    const businessId = getBusinessId();

    // 1. Delete previous entries for this class and date to prevent duplication
    const { error: deleteError } = await supabase
      .from("school_attendance")
      .delete()
      .eq("business_id", businessId)
      .eq("class_id", classId)
      .eq("date", date)
      .eq("type", "student");

    if (deleteError) throw deleteError;

    if (records.length === 0) return [];

    // 2. Prepare payload
    const toInsert = records.map(r => ({
      business_id: businessId,
      date,
      type: "student",
      person_id: r.student_id,
      class_id: classId,
      status: r.status,
      note: r.note || null
    }));

    // 3. Bulk insert
    const { data, error: insertError } = await supabase
      .from("school_attendance")
      .insert(toInsert)
      .select();

    if (insertError) throw insertError;
    return data as SchoolAttendanceRecord[];
  }
};
