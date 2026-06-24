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

  async getByIdWithItems(id: string) {
    const { data, error } = await supabase
      .from("school_invoices")
      .select("*, student:student_id(*), academic_year:academic_year_id(*), items:school_invoice_items(*), plans:school_payment_plans(*)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as SchoolInvoice & { student?: any; academic_year?: any; items?: any[]; plans?: any[] };
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

  async generateFromEnrollment(studentId: string, classId: string, academicYearId: string, businessId: string, skipEnrollmentFee: boolean = false) {
    const fees = await this.getFeesForClass(classId, academicYearId);

    // Fetch student to check for scholarship
    const { data: student } = await supabase
      .from("school_students")
      .select("scholarship_type, scholarship_percentage")
      .eq("id", studentId)
      .single();

    let discountMultiplier = 1;
    if (student) {
      if (student.scholarship_type === 'full') discountMultiplier = 0;
      else if (student.scholarship_type === 'half') discountMultiplier = 0.5;
      else if (student.scholarship_percentage) discountMultiplier = 1 - (student.scholarship_percentage / 100);
    }

    // Apply discount only to tuition fees — frais d'inscription are always at full price
    const applyDiscount = (fee: any) => ({
      ...fee,
      originalAmount: fee.amount,
      amount: fee.amount * discountMultiplier
    });

    // If no fees configured, still generate a zero-amount enrollment invoice for the slip
    if (fees.length === 0) {
      const { data: invNum, error: numErr } = await supabase.rpc('generate_school_invoice_number', { p_business_id: businessId });
      if (numErr) throw numErr;

      const { data: blankInvoice, error: blankErr } = await supabase.from("school_invoices").insert([{
        business_id: businessId, student_id: studentId, academic_year_id: academicYearId,
        invoice_number: invNum, total_amount: 0, paid_amount: 0, balance: 0,
        status: 'pending', issue_date: new Date().toISOString()
      }]).select().single();
      if (blankErr) throw blankErr;
      return [blankInvoice];
    }

    // Enrollment fees → always full price, tuition fees → discounted
    let enrollmentFees = fees.filter(f => f.category?.fee_type === 'enrollment');
    const tuitionFees = fees.filter(f => f.category?.fee_type !== 'enrollment').map(applyDiscount);
    
    if (skipEnrollmentFee) {
      enrollmentFees = [];
    }

    const invoices = [];
    
    // 1. Generate Enrollment Invoice (if applicable)
    if (enrollmentFees.length > 0) {
      const { data: invNumEnroll, error: errNumEnroll } = await supabase.rpc('generate_school_invoice_number', { p_business_id: businessId });
      if (errNumEnroll) throw errNumEnroll;
      
      const enrollAmount = enrollmentFees.reduce((sum, f) => sum + Number(f.amount), 0);
      
      const { data: enrollInvoice, error: invErr1 } = await supabase.from("school_invoices").insert([{
        business_id: businessId, student_id: studentId, academic_year_id: academicYearId,
        invoice_number: invNumEnroll, total_amount: enrollAmount, paid_amount: 0, balance: enrollAmount,
        status: 'pending', issue_date: new Date().toISOString()
      }]).select().single();
      if (invErr1) throw invErr1;

      const enrollItems = enrollmentFees.map(fee => ({
        invoice_id: enrollInvoice.id, fee_id: fee.id, business_id: businessId,
        description: `Frais: ${fee.category?.name || 'Inscription'}`, amount: fee.amount,
      }));
      await supabase.from("school_invoice_items").insert(enrollItems);
      
      // Auto payment plan (Single payment for enrollment)
      await supabase.from("school_payment_plans").insert([{
        invoice_id: enrollInvoice.id, business_id: businessId, title: "Frais d'inscription",
        amount_due: enrollAmount, amount_paid: 0, balance: enrollAmount, status: 'pending', due_date: new Date().toISOString()
      }]);
      invoices.push(enrollInvoice);
    }

    // 2. Generate Tuition Invoice
    if (tuitionFees.length > 0) {
      const { data: invNumTuition, error: errNumTuition } = await supabase.rpc('generate_school_invoice_number', { p_business_id: businessId });
      if (errNumTuition) throw errNumTuition;
      
      const tuitionAmount = tuitionFees.reduce((sum, f) => sum + Number(f.amount), 0);
      
      const { data: tuitionInvoice, error: invErr2 } = await supabase.from("school_invoices").insert([{
        business_id: businessId, student_id: studentId, academic_year_id: academicYearId,
        invoice_number: invNumTuition, total_amount: tuitionAmount, paid_amount: 0, balance: tuitionAmount,
        status: 'pending', issue_date: new Date().toISOString()
      }]).select().single();
      if (invErr2) throw invErr2;

      const tuitionItems = tuitionFees.map(fee => ({
        invoice_id: tuitionInvoice.id, fee_id: fee.id, business_id: businessId,
        description: `Frais: ${fee.category?.name || 'Scolarité'}`, amount: fee.amount,
      }));
      await supabase.from("school_invoice_items").insert(tuitionItems);
      
      // Payment plan based on template
      await this.generatePaymentPlan(tuitionInvoice.id, tuitionAmount, businessId, classId, academicYearId);
      invoices.push(tuitionInvoice);
    }

    return invoices;
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
      let plans = template.installments.map((inst: any) => {
        const rawAmount = inst.is_percentage
          ? (totalAmount * inst.percentage_or_amount) / 100
          : inst.percentage_or_amount;
        return {
          invoice_id: invoiceId,
          business_id: businessId,
          title: inst.title,
          amount_due: rawAmount,
          amount_paid: 0,
          balance: rawAmount,
          due_date: inst.due_date || null,
          status: 'pending' as const,
        };
      });

      const plansSum = plans.reduce((acc: number, p: any) => acc + Number(p.amount_due), 0);
      
      // If the template uses fixed amounts but the student has a discount, scale down the plans
      if (plansSum > totalAmount && plansSum > 0) {
        const scale = totalAmount / plansSum;
        plans = plans.map(p => ({
          ...p,
          amount_due: p.amount_due * scale,
          balance: p.amount_due * scale,
        }));
      } else if (plansSum === 0) {
        plans = plans.map(p => ({ ...p, amount_due: 0, balance: 0 }));
      }
      if (plansSum < totalAmount) {
        // Ajouter la différence (ex: frais d'inscription) comme premier versement exigible immédiatement
        plans.unshift({
          invoice_id: invoiceId,
          business_id: businessId,
          title: "Frais initiaux (Inscription & Autres)",
          amount_due: totalAmount - plansSum,
          amount_paid: 0,
          balance: totalAmount - plansSum,
          due_date: new Date().toISOString(), // Exigible immédiatement
          status: 'pending' as const,
        });
      }

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
