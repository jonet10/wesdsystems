import { supabase } from "@/lib/supabase";
import { getBusinessId } from "./utils";
import { format } from "date-fns";

export interface PaymentReportRow {
  date: string;
  receipt_number: string;
  student_name: string;
  invoice_number: string;
  payment_method: string;
  amount: number;
}

export interface OutstandingReportRow {
  student_name: string;
  matricule: string;
  class_name: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
}

export interface ExpenseReportRow {
  date: string;
  category: string;
  description: string;
  amount: number;
}

export const reportService = {
  async getPaymentReport(startDate?: string, endDate?: string) {
    const businessId = getBusinessId();
    let query = supabase
      .from("school_payments")
      .select("*, invoice:invoice_id(*, student:student_id(*))")
      .eq("business_id", businessId)
      .order("payment_date", { ascending: false });

    if (startDate) query = query.gte("payment_date", startDate);
    if (endDate) query = query.lte("payment_date", endDate);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(p => ({
      date: format(new Date(p.payment_date), "dd/MM/yyyy HH:mm"),
      receipt_number: p.receipt_number,
      student_name: `${p.invoice?.student?.first_name || ''} ${p.invoice?.student?.last_name || ''}`,
      invoice_number: p.invoice?.invoice_number || '',
      payment_method: p.payment_method,
      amount: Number(p.amount),
    })) as PaymentReportRow[];
  },

  async getEnrollmentPaymentReport(startDate?: string, endDate?: string) {
    const businessId = getBusinessId();
    let query = supabase
      .from("school_payments")
      .select("*, invoice:invoice_id(*, student:student_id(*), items:school_invoice_items(*, fee:fee_id(*, category:category_id(*))))")
      .eq("business_id", businessId)
      .order("payment_date", { ascending: false });

    if (startDate) query = query.gte("payment_date", startDate);
    if (endDate) query = query.lte("payment_date", endDate);

    const { data, error } = await query;
    if (error) throw error;

    const filtered = (data || []).filter(p => {
      const items = p.invoice?.items || [];
      return items.some((item: any) => item.fee?.category?.fee_type === 'enrollment');
    });

    return filtered.map(p => ({
      date: format(new Date(p.payment_date), "dd/MM/yyyy HH:mm"),
      receipt_number: p.receipt_number,
      student_name: `${p.invoice?.student?.first_name || ''} ${p.invoice?.student?.last_name || ''}`,
      invoice_number: p.invoice?.invoice_number || '',
      payment_method: p.payment_method,
      amount: Number(p.amount),
    })) as PaymentReportRow[];
  },

  async getOutstandingReport(classId?: string, statusFilter?: string) {
    const businessId = getBusinessId();

    const { data: classData } = classId
      ? await supabase.from("school_classes").select("code").eq("id", classId).single()
      : { data: null };

    let studentIds: string[] | undefined;
    if (classData?.code) {
      const { data: students } = await supabase
        .from("school_students")
        .select("id")
        .eq("business_id", businessId)
        .eq("class_level", classData.code);
      studentIds = (students || []).map(s => s.id);
      if (studentIds.length === 0) return [];
    }

    let query = supabase
      .from("school_invoices")
      .select("*, student:student_id(*), academic_year:academic_year_id(*)")
      .eq("business_id", businessId)
      .neq("status", "paid")
      .order("balance", { ascending: false });

    if (studentIds) query = query.in("student_id", studentIds);
    if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(inv => ({
      student_name: `${inv.student?.first_name || ''} ${inv.student?.last_name || ''}`,
      matricule: inv.student?.matricule || '',
      class_name: inv.student?.class_level || '',
      invoice_number: inv.invoice_number,
      total_amount: Number(inv.total_amount),
      paid_amount: Number(inv.paid_amount),
      balance: Number(inv.balance),
      status: inv.status,
    })) as OutstandingReportRow[];
  },

  async getExpenseReport(startDate?: string, endDate?: string) {
    const businessId = getBusinessId();
    let query = supabase
      .from("school_expenses")
      .select("*")
      .eq("business_id", businessId)
      .order("expense_date", { ascending: false });

    if (startDate) query = query.gte("expense_date", startDate);
    if (endDate) query = query.lte("expense_date", endDate);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(exp => ({
      date: exp.expense_date ? format(new Date(exp.expense_date), "dd/MM/yyyy") : '-',
      category: exp.category,
      description: exp.description || '',
      amount: Number(exp.amount),
    })) as ExpenseReportRow[];
  },

  async getRevenueExpenseComparison(startDate?: string, endDate?: string) {
    const businessId = getBusinessId();
    let payQuery = supabase
      .from("school_payments")
      .select("amount, payment_date")
      .eq("business_id", businessId)
      .order("payment_date", { ascending: true });

    let expQuery = supabase
      .from("school_expenses")
      .select("amount, expense_date")
      .eq("business_id", businessId)
      .order("expense_date", { ascending: true });

    if (startDate) {
      payQuery = payQuery.gte("payment_date", startDate);
      expQuery = expQuery.gte("expense_date", startDate);
    }
    if (endDate) {
      payQuery = payQuery.lte("payment_date", endDate);
      expQuery = expQuery.lte("expense_date", endDate);
    }

    const [payRes, expRes] = await Promise.all([payQuery, expQuery]);
    if (payRes.error) throw payRes.error;
    if (expRes.error) throw expRes.error;

    const totalRevenue = (payRes.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const totalExpenses = (expRes.data || []).reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      totalRevenue,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
      revenueCount: (payRes.data || []).length,
      expenseCount: (expRes.data || []).length,
    };
  },

  async getClassList(classId: string) {
    const { data, error } = await supabase
      .from("school_enrollments")
      .select("*, student:student_id(*)")
      .eq("class_id", classId)
      .in("status", ["registered", "active"]);
    if (error) throw error;

    return (data || []).map((enr: any, index: number) => ({
      numero: index + 1,
      matricule: enr.student?.matricule || '',
      nom_complet: `${enr.student?.first_name || ''} ${enr.student?.last_name || ''}`,
      sexe: enr.student?.gender || '',
      telephone_parent: enr.student?.responsible_person_info?.phone || enr.student?.phone || '',
    }));
  }
};
