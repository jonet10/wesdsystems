import { supabase } from "@/lib/supabase";
import type { SchoolEnrollment, SchoolInvoice, SchoolInvoiceItem, SchoolPaymentPlan } from "@/modules/school/types";
import { getBusinessId } from "./utils";
import { invoiceService } from "./invoiceService";

export interface CreateEnrollmentPayload {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  branch_id?: string;
  enrollment_date?: string;
  status?: 'registered' | 'active' | 'withdrawn';
  auto_generate_invoice?: boolean;
}

export const enrollmentService = {
  async getAll() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_enrollments")
      .select("*, school_class:class_id(*), academic_year:academic_year_id(*), student:student_id(*)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as (SchoolEnrollment & { student?: any })[];
  },

  async getByStudent(studentId: string) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_enrollments")
      .select("*, school_class:class_id(*), academic_year:academic_year_id(*)")
      .eq("business_id", businessId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as (SchoolEnrollment & { school_class?: any; academic_year?: any })[];
  },

  async getByClass(classId: string) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_enrollments")
      .select("*, student:student_id(*), academic_year:academic_year_id(*)")
      .eq("business_id", businessId)
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as (SchoolEnrollment & { student?: any; academic_year?: any })[];
  },

  async getActiveByAcademicYear(academicYearId: string) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_enrollments")
      .select("*, student:student_id(*), school_class:class_id(*), academic_year:academic_year_id(*)")
      .eq("business_id", businessId)
      .eq("academic_year_id", academicYearId)
      .in("status", ["registered", "active"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as (SchoolEnrollment & { student?: any; school_class?: any; academic_year?: any })[];
  },

  async create(payload: CreateEnrollmentPayload) {
    const businessId = getBusinessId();
    const enrollmentPayload = {
      business_id: businessId,
      branch_id: payload.branch_id || null,
      student_id: payload.student_id,
      class_id: payload.class_id,
      academic_year_id: payload.academic_year_id,
      enrollment_date: payload.enrollment_date || new Date().toISOString(),
      status: payload.status || 'active',
    };

    const { data, error } = await supabase
      .from("school_enrollments")
      .insert([enrollmentPayload])
      .select()
      .single();
    if (error) throw error;

    const enrollment = data as SchoolEnrollment;

    if (payload.auto_generate_invoice !== false) {
      await invoiceService.generateFromEnrollment(
        payload.student_id,
        payload.class_id,
        payload.academic_year_id,
        businessId
      );
    }

    return enrollment;
  },

  async transfer(studentId: string, newClassId: string, academicYearId: string) {
    const businessId = getBusinessId();
    const { data: currentEnrollment, error: findError } = await supabase
      .from("school_enrollments")
      .select("*")
      .eq("business_id", businessId)
      .eq("student_id", studentId)
      .eq("academic_year_id", academicYearId)
      .in("status", ["registered", "active"])
      .maybeSingle();
    if (findError) throw findError;

    if (currentEnrollment) {
      const { error: updateError } = await supabase
        .from("school_enrollments")
        .update({ status: 'withdrawn' })
        .eq("id", currentEnrollment.id);
      if (updateError) throw updateError;
    }

    return this.create({
      student_id: studentId,
      class_id: newClassId,
      academic_year_id: academicYearId,
      status: 'active',
      auto_generate_invoice: false,
    });
  },

  async updateStatus(id: string, status: 'registered' | 'active' | 'withdrawn') {
    const { data, error } = await supabase
      .from("school_enrollments")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as SchoolEnrollment;
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("school_enrollments")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async getHistory(studentId: string) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_enrollments")
      .select("*, school_class:class_id(name, code), academic_year:academic_year_id(name)")
      .eq("business_id", businessId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getStats() {
    const businessId = getBusinessId();
    const { count } = await supabase
      .from("school_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["registered", "active"]);
    return count || 0;
  }
};
