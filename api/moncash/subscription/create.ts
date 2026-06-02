import { apiSupabase } from "../../_supabase";
import { json } from "../../pending-tabs/_shared";
import { createMonCashPayment } from "../_service";

const toNumber = (value: unknown) => Number(value || 0);

const addBillingCycle = (date: Date, billingCycle: string) => {
  const next = new Date(date);
  if (billingCycle === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
};

const resolveBusinessSubscription = async (businessId: string, subscriptionId: string | null) => {
  if (subscriptionId) {
    const { data, error } = await apiSupabase
      .from("business_subscriptions")
      .select("id, business_id, plan_id, start_date, end_date, status, billing_cycle, auto_renew, price_snapshot, currency_code, notes")
      .eq("id", subscriptionId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  const { data, error } = await apiSupabase
    .from("business_subscriptions")
    .select("id, business_id, plan_id, start_date, end_date, status, billing_cycle, auto_renew, price_snapshot, currency_code, notes")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    const body = req.body || {};
    const businessId = String(body.business_id || body.businessId || "");
    const subscriptionId = body.subscription_id ? String(body.subscription_id) : null;
    const requestedPlanId = body.plan_id ? String(body.plan_id) : "";
    const billingCycle = String(body.billing_cycle || "monthly");

    if (!businessId) return json(res, 400, { error: "business_id requis" });

    const { data: business, error: businessError } = await apiSupabase
      .from("businesses")
      .select("id, name, plan_id, status")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) throw businessError;
    if (!business) return json(res, 404, { error: "Business introuvable" });

    const currentSubscription = await resolveBusinessSubscription(businessId, subscriptionId);
    const planId = requestedPlanId || currentSubscription?.plan_id || business.plan_id || "";
    if (!planId) return json(res, 400, { error: "Plan introuvable" });

    const { data: plan, error: planError } = await apiSupabase
      .from("subscription_plans")
      .select("id, name, monthly_price, yearly_price, active")
      .eq("id", planId)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) return json(res, 404, { error: "Plan introuvable" });
    if (plan.active === false) return json(res, 400, { error: "Plan inactif" });

    const amount = billingCycle === "yearly"
      ? toNumber(plan.yearly_price || toNumber(plan.monthly_price) * 12)
      : toNumber(plan.monthly_price);

    if (amount <= 0) {
      return json(res, 400, { error: "Le montant de l'abonnement doit être supérieur à 0" });
    }

    const orderId = `sub_${businessId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;
    const { data: paymentRow, error: insertError } = await apiSupabase
      .from("moncash_subscription_payments")
      .insert({
        business_id: businessId,
        subscription_id: currentSubscription?.id || subscriptionId || null,
        plan_id: planId,
        billing_cycle: billingCycle,
        payment_provider: "moncash",
        amount,
        currency_code: "HTG",
        order_id: orderId,
        status: "pending",
        gateway_payload: {
          business_name: business.name,
          plan_name: plan.name,
          billing_cycle: billingCycle,
        },
      })
      .select("id, order_id")
      .single();

    if (insertError) throw insertError;

    let payment;
    try {
      payment = await createMonCashPayment(orderId, amount);
    } catch (error: any) {
      await apiSupabase
        .from("moncash_subscription_payments")
        .update({
          status: "failed",
          notes: error?.message || "Echec de création du paiement MonCash",
        })
        .eq("id", paymentRow.id);
      throw error;
    }

    const { error: updateError } = await apiSupabase
      .from("moncash_subscription_payments")
      .update({
        redirect_url: payment.redirectUrl,
        status: "redirected",
        gateway_payload: payment.raw,
      })
      .eq("id", paymentRow.id);

    if (updateError) throw updateError;

    return json(res, 200, {
      data: {
        payment_id: paymentRow.id,
        order_id: orderId,
        redirect_url: payment.redirectUrl,
        amount,
        currency_code: "HTG",
        business: {
          id: business.id,
          name: business.name,
        },
        plan: {
          id: plan.id,
          name: plan.name,
        },
      },
    });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Impossible de créer le paiement MonCash" });
  }
}
