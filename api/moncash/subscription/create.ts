import { apiSupabase } from "../../supabase";
import { json } from "../../pending-tabs/shared";
import { createMonCashPayment } from "../service";

const toNumber = (value: unknown) => Number(value || 0);

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    const body = req.body || {};
    const businessId = String(body.business_id || body.businessId || "");
    const planId = String(body.plan_id || body.planId || "");
    const paymentId = body.payment_id ? String(body.payment_id) : null;
    const billingCycle = String(body.billing_cycle || "monthly");
    const durationMonths = Math.max(1, Math.min(12, Number(body.duration_months || 1)));

    if (!businessId) return json(res, 400, { error: "business_id requis" });
    if (!planId) return json(res, 400, { error: "plan_id requis" });

    const { data: business, error: businessError } = await apiSupabase
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) throw businessError;
    if (!business) return json(res, 404, { error: "Business introuvable" });

    const { data: plan, error: planError } = await apiSupabase
      .from("subscription_plans")
      .select("id, name, monthly_price, yearly_price, active")
      .eq("id", planId)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) return json(res, 404, { error: "Plan introuvable" });
    if (plan.active === false) return json(res, 400, { error: "Plan inactif" });

    const monthlyPrice = toNumber(plan.monthly_price);
    const amount = monthlyPrice * durationMonths;

    if (amount <= 0) {
      return json(res, 400, { error: "Le montant doit être supérieur à 0" });
    }

    const orderId = `sub_${businessId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;

    let payment;
    try {
      payment = await createMonCashPayment(orderId, amount);
    } catch (error: any) {
      if (paymentId) {
        await apiSupabase
          .from("subscription_payments")
          .update({ status: "failed" })
          .eq("id", paymentId);
      }
      throw error;
    }

    // Update the client-created subscription_payments record
    if (paymentId) {
      await apiSupabase
        .from("subscription_payments")
        .update({
          transaction_reference: orderId,
          status: "pending_verification",
        })
        .eq("id", paymentId);
    }

    // Insert into moncash_subscription_payments for the return callback
    const { error: insertError } = await apiSupabase
      .from("moncash_subscription_payments")
      .insert({
        business_id: businessId,
        plan_id: planId,
        billing_cycle: billingCycle,
        duration_months: durationMonths,
        payment_provider: "moncash",
        amount,
        currency_code: "HTG",
        order_id: orderId,
        status: "redirected",
        redirect_url: payment.redirectUrl,
        gateway_payload: {
          business_name: business.name,
          plan_name: plan.name,
          billing_cycle: billingCycle,
          duration_months: durationMonths,
        },
      });

    if (insertError) throw insertError;

    return json(res, 200, {
      data: {
        payment_id: paymentId || null,
        order_id: orderId,
        redirect_url: payment.redirectUrl,
        amount,
        currency_code: "HTG",
        duration_months: durationMonths,
      },
    });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Impossible de créer le paiement MonCash" });
  }
}
