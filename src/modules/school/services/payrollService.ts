import { supabase } from "@/lib/supabase";
import type { SchoolPayroll } from "@/modules/school/types";
import { getBusinessId } from "./utils";

const MONTHS_FR = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export const payrollService = {
  /** Fetch all payroll entries for a given month/year, with teacher data */
  async getByMonth(month: number, year: number): Promise<SchoolPayroll[]> {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_payroll")
      .select("*, teacher:school_teachers(id, first_name, last_name, job_title, salary, active, subjects)")
      .eq("business_id", businessId)
      .eq("month", month)
      .eq("year", year)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data as SchoolPayroll[];
  },

  /** Generate payroll entries for all active staff who don't have one yet for this month */
  async generateForMonth(month: number, year: number): Promise<SchoolPayroll[]> {
    const businessId = getBusinessId();

    // 1. Get all active teachers/staff
    const { data: teachers, error: teacherError } = await supabase
      .from("school_teachers")
      .select("id, salary")
      .eq("business_id", businessId)
      .eq("active", true);
    if (teacherError) throw teacherError;

    if (!teachers || teachers.length === 0) {
      throw new Error("Aucun membre du personnel actif trouvé.");
    }

    // 2. Get existing payroll entries for this month (to avoid duplicates)
    const { data: existing } = await supabase
      .from("school_payroll")
      .select("teacher_id")
      .eq("business_id", businessId)
      .eq("month", month)
      .eq("year", year);

    const existingIds = new Set((existing || []).map((e: any) => e.teacher_id));

    // 3. Insert missing entries
    const toInsert = teachers
      .filter(t => !existingIds.has(t.id))
      .map(t => ({
        business_id: businessId,
        month,
        year,
        teacher_id: t.id,
        gross_salary: Number(t.salary) || 0,
        absence_days: 0,
        deduction: 0,
        net_salary: Number(t.salary) || 0,
        status: "pending",
      }));

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("school_payroll")
        .insert(toInsert);
      if (insertError) throw insertError;
    }

    return payrollService.getByMonth(month, year);
  },

  /** Update gross, absences, deduction and recalculate net */
  async update(id: string, payload: {
    gross_salary?: number;
    absence_days?: number;
    deduction?: number;
    working_days_per_month?: number;
  }): Promise<SchoolPayroll> {
    // Fetch current to recalculate
    const { data: current } = await supabase
      .from("school_payroll")
      .select("gross_salary, absence_days, deduction")
      .eq("id", id)
      .single();

    const gross = payload.gross_salary ?? Number(current?.gross_salary) ?? 0;
    const absences = payload.absence_days ?? Number(current?.absence_days) ?? 0;
    const deduction = payload.deduction ?? Number(current?.deduction) ?? 0;
    const workingDays = payload.working_days_per_month ?? 22;

    const dailyRate = gross / workingDays;
    const absenceDeduction = Math.round(dailyRate * absences);
    const net = Math.max(0, gross - absenceDeduction - deduction);

    const { data, error } = await supabase
      .from("school_payroll")
      .update({ gross_salary: gross, absence_days: absences, deduction, net_salary: net })
      .eq("id", id)
      .select("*, teacher:school_teachers(id, first_name, last_name, job_title, salary, active, subjects)")
      .single();
    if (error) throw error;
    return data as SchoolPayroll;
  },

  /** Mark payroll as paid and create an expense entry */
  async markPaid(id: string, payMethod: string): Promise<SchoolPayroll> {
    const businessId = getBusinessId();

    // Get payroll details
    const { data: payroll, error: fetchError } = await supabase
      .from("school_payroll")
      .select("*, teacher:school_teachers(first_name, last_name, job_title)")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    const teacherName = `${(payroll as any).teacher?.first_name} ${(payroll as any).teacher?.last_name}`;
    const monthLabel = MONTHS_FR[payroll.month] || payroll.month;

    // Create expense
    const { data: expense, error: expenseError } = await supabase
      .from("school_expenses")
      .insert([{
        business_id: businessId,
        category: "Salaires",
        amount: payroll.net_salary,
        expense_date: new Date().toISOString().split("T")[0],
        description: `Salaire ${monthLabel} ${payroll.year} — ${teacherName}`,
      }])
      .select()
      .single();
    if (expenseError) throw expenseError;

    // Mark as paid
    const { data, error } = await supabase
      .from("school_payroll")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        pay_method: payMethod,
        expense_id: expense.id,
      })
      .eq("id", id)
      .select("*, teacher:school_teachers(id, first_name, last_name, job_title, salary, active, subjects)")
      .single();
    if (error) throw error;
    return data as SchoolPayroll;
  },

  /** Delete a payroll entry (reset / undo generation) */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("school_payroll").delete().eq("id", id);
    if (error) throw error;
  },
};
