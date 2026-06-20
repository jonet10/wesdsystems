import { supabase } from "@/lib/supabase";
import type { SchoolInvoice, SchoolInvoiceItem, SchoolPaymentPlan } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const invoiceService = {
  async getAll() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_invoices")
      .select("*, student:student_id(*), academic_year:academic_year_id(*)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as (SchoolInvoice & { student?: any; academic_year?: any })[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("school_invoices")
      .select("*, student:student_id(*), academic_year:academic_year_id(*)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as SchoolInvoice & { student?: any; academic_year?: any };
  },

  async getByStudent(studentId: string) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_invoices")
      .select("*, academic_year:academic_year_id(*)")
      .eq("business_id", businessId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as (SchoolInvoice & { academic_year?: any })[];
  },

  async getPending() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_invoices")
      .select("*, student:student_id(*)")
      .eq("business_id", businessId)
      .neq("status", "paid")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as (SchoolInvoice & { student?: any })[];
  },

  async generateFromEnrollment(studentId: string, classId: string, academicYearId: string, businessId: string) {
    const fees = await this.getFeesForClass(classId, academicYearId);
    if (fees.length === 0) return null;

    const { data: invoiceNum, error: rpcError } = await supabase.rpc('generate_school_invoice_number', {
      p_business_id: businessId
    });
    if (rpcError) throw rpcError;

    const totalAmount = fees.reduce((sum, f) => sum + Number(f.amount), 0);

    const { data: invoice, error: invError } = await supabase
      .from("school_invoices")
      .insert([{
        business_id: businessId,
        student_id: studentId,
        academic_year_id: academicYearId,
        invoice_number: invoiceNum,
        total_amount: totalAmount,
        paid_amount: 0,
        balance: totalAmount,
        status: 'pending',
        issue_date: new Date().toISOString(),
      }])
      .select()
      .single();
    if (invError) throw invError;

    const invoiceItems = fees.map(fee => ({
      invoice_id: invoice.id,
      fee_id: fee.id,
      business_id: businessId,
      description: `Frais: ${fee.category?.name || 'Scolarité'}`,
      amount: fee.amount,
    }));

    const { error: itemsError } = await supabase
      .from("school_invoice_items")
      .insert(invoiceItems);
    if (itemsError) throw itemsError;

    const plan = await this.generatePaymentPlan(invoice.id, totalAmount, businessId, classId, academicYearId);

    return { invoice, plan };
  },

  async getFeesForClass(classId: string, academicYearId: string) {
    const { data, error } = await supabase
      .from("school_fees")
      .select("*, category:category_id(*)")
      .eq("class_id", classId)
      .eq("academic_year_id", academicYearId);
    if (error) throw error;
    return data as any[];
  },

  async generatePaymentPlan(invoiceId: string, totalAmount: number, businessId: string, classId: string, academicYearId: string) {
    const { data: template, error: tmplError } = await supabase
      .from("school_payment_templates")
      .select("*, installments:school_payment_template_installments(*)")
      .eq("class_id", classId)
      .eq("academic_year_id", academicYearId)
      .maybeSingle();
    if (tmplError && tmplError.code !== 'PGRST116') throw tmplError;

    if (template?.installments?.length) {
      const plans = template.installments.map((inst: any) => {
        const amountDue = inst.is_percentage
          ? (totalAmount * inst.percentage_or_amount) / 100
          : inst.percentage_or_amount;
        return {
          invoice_id: invoiceId,
          business_id: businessId,
          title: inst.title,
          amount_due: amountDue,
          amount_paid: 0,
          balance: amountDue,
          due_date: inst.due_date || null,
          status: 'pending' as const,
        };
      });

      const { data, error } = await supabase
        .from("school_payment_plans")
        .insert(plans)
        .select();
      if (error) throw error;
      return data as SchoolPaymentPlan[];
    }

    const defaultPlan = {
      invoice_id: invoiceId,
      business_id: businessId,
      title: "Paiement unique",
      amount_due: totalAmount,
      amount_paid: 0,
      balance: totalAmount,
      status: 'pending' as const,
    };
    const { data, error } = await supabase
      .from("school_payment_plans")
      .insert([defaultPlan])
      .select();
    if (error) throw error;
    return data as SchoolPaymentPlan[];
  },

  async getStats() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_invoices")
      .select("total_amount, paid_amount, balance")
      .eq("business_id", businessId);
    if (error) throw error;
    return {
      totalBilled: data.reduce((sum, inv) => sum + Number(inv.total_amount), 0),
      totalPaid: data.reduce((sum, inv) => sum + Number(inv.paid_amount), 0),
      totalBalance: data.reduce((sum, inv) => sum + Number(inv.balance), 0),
    };
  }
};
