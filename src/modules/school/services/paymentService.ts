import { supabase } from "@/lib/supabase";
import type { SchoolPayment, SchoolPaymentPlan } from "@/modules/school/types";
import { getBusinessId } from "./utils";

export const paymentService = {
  async getAll(limit = 50) {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_payments")
      .select("*, invoice:invoice_id(*, student:student_id(*))")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as (SchoolPayment & { invoice?: any })[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("school_payments")
      .select("*, invoice:invoice_id(*, student:student_id(*))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as SchoolPayment & { invoice?: any };
  },

  async recordPayment(params: {
    invoice_id: string;
    amount: number;
    payment_method: string;
    reference?: string;
    payment_plan_id?: string;
    created_by?: string;
  }) {
    const businessId = getBusinessId();
    const { data: receiptNum, error: rpcError } = await supabase.rpc('generate_school_receipt_number', {
      p_business_id: businessId
    });
    if (rpcError) throw rpcError;

    const paymentPayload = {
      business_id: businessId,
      invoice_id: params.invoice_id,
      payment_plan_id: params.payment_plan_id || null,
      receipt_number: receiptNum,
      amount: params.amount,
      payment_method: params.payment_method,
      reference: params.reference || null,
      created_by: params.created_by,
    };

    const { data: newPayment, error: payError } = await supabase
      .from("school_payments")
      .insert([paymentPayload])
      .select()
      .single();
    if (payError) throw payError;

    const { data: invoice } = await supabase
      .from("school_invoices")
      .select("paid_amount, balance, status")
      .eq("id", params.invoice_id)
      .single();

    if (invoice) {
      const newPaidAmount = Number(invoice.paid_amount) + params.amount;
      const newBalance = Number(invoice.balance) - params.amount;
      let newStatus = invoice.status;
      if (newBalance <= 0) newStatus = 'paid';
      else if (newPaidAmount > 0) newStatus = 'partial';

      await supabase
        .from("school_invoices")
        .update({
          paid_amount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        })
        .eq("id", params.invoice_id);
    }

    if (params.payment_plan_id) {
      const { data: plan } = await supabase
        .from("school_payment_plans")
        .select("amount_due, amount_paid, balance")
        .eq("id", params.payment_plan_id)
        .single();

      if (plan) {
        const newPlanPaid = Number(plan.amount_paid) + params.amount;
        const newPlanBalance = Number(plan.balance) - params.amount;
        let planStatus = plan.status;
        if (newPlanBalance <= 0) planStatus = 'paid';
        else if (newPlanPaid > 0) planStatus = 'partial';

        await supabase
          .from("school_payment_plans")
          .update({
            amount_paid: newPlanPaid,
            balance: newPlanBalance,
            status: planStatus,
          })
          .eq("id", params.payment_plan_id);
      }
    }

    return newPayment as SchoolPayment;
  },

  async getStats() {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_payments")
      .select("amount")
      .eq("business_id", businessId);
    if (error) throw error;
    return data.reduce((sum, p) => sum + Number(p.amount), 0);
  }
};
