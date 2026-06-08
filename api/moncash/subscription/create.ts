import { apiSupabase } from "../../supabase.js";
import { json } from "../../pending-tabs/shared.js";
import { createMonCashPayment, getMonCashEnvironment } from "../service.js";

const toNumber = (value: unknown) => Number(value || 0);

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    const body = req.body || {};
    const businessId = String(body.business_id || body.businessId || "");
    const planId = String(body.plan_id || body.planId || "");
    const businessName = String(body.business_name || body.businessName || "");
    const paymentId = body.payment_id ? String(body.payment_id) : null;
    const billingCycle = String(body.billing_cycle || "monthly");
    const durationMonths = Math.max(1, Math.min(12, Number(body.duration_months || 1)));

    if (!businessId) return json(res, 400, { error: "business_id requis" });
    if (!planId) return json(res, 400, { error: "plan_id requis" });

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

    // Create subscription_payments record via RPC (bypasses RLS)
    let subscriptionPaymentId = paymentId;
    if (!subscriptionPaymentId) {
      const { data: spId, error: spError } = await apiSupabase.rpc(
        "create_subscription_payment",
        {
          p_business_id: businessId,
          p_plan_id: planId,
          p_amount: amount,
          p_currency_code: "HTG",
          p_payment_method: "moncash",
          p_transaction_reference: orderId,
          p_status: "pending",
        }
      );

      if (spError) throw spError;
      subscriptionPaymentId = spId;
    }

    // ── Sandbox shortcut: bypass MonCash, complete immediately ──────────
    const isSandbox = getMonCashEnvironment() === "sandbox";

    if (isSandbox) {
      await apiSupabase.rpc("update_subscription_payment", {
        p_id: subscriptionPaymentId,
        p_transaction_reference: orderId,
        p_status: "completed",
      });

      await apiSupabase.rpc("create_moncash_subscription_payment", {
        p_business_id: businessId,
        p_plan_id: planId,
        p_billing_cycle: billingCycle,
        p_duration_months: durationMonths,
        p_payment_provider: "moncash",
        p_amount: amount,
        p_currency_code: "HTG",
        p_order_id: orderId,
        p_status: "completed",
        p_redirect_url: null,
        p_gateway_payload: {
          business_name: businessName,
          plan_name: plan.name,
          billing_cycle: billingCycle,
          duration_months: durationMonths,
          sandbox: true,
        },
      });

      const confirmationUrl = `/moncash/confirmation?payment_id=${subscriptionPaymentId}&reference=${orderId}&status=success&sandbox=true`;

      return json(res, 200, {
        data: {
          payment_id: subscriptionPaymentId,
          order_id: orderId,
          redirect_url: confirmationUrl,
          amount,
          currency_code: "HTG",
          duration_months: durationMonths,
          sandbox: true,
        },
      });
    }

    // ── Live flow: real MonCash CreatePayment ───────────────────────────
    let payment;
    try {
      payment = await createMonCashPayment(orderId, amount);
    } catch (error: any) {
      if (subscriptionPaymentId) {
        await apiSupabase.rpc("update_subscription_payment", {
          p_id: subscriptionPaymentId,
          p_status: "failed",
        });
      }
      const isTimeout = error?.name === "AbortError";
      throw new Error(isTimeout
        ? "Le service MonCash ne répond pas (délai d'attente dépassé). Veuillez réessayer."
        : error?.message || "Impossible de créer le paiement MonCash."
      );
    }

    // Mark as pending verification after MonCash redirect URL obtained
    if (subscriptionPaymentId) {
      await apiSupabase.rpc("update_subscription_payment", {
        p_id: subscriptionPaymentId,
        p_transaction_reference: orderId,
        p_status: "pending_verification",
      });
    }

    // Insert into moncash_subscription_payments via RPC (bypasses RLS)
    const { error: insertError } = await apiSupabase.rpc(
      "create_moncash_subscription_payment",
      {
        p_business_id: businessId,
        p_plan_id: planId,
        p_billing_cycle: billingCycle,
        p_duration_months: durationMonths,
        p_payment_provider: "moncash",
        p_amount: amount,
        p_currency_code: "HTG",
        p_order_id: orderId,
        p_status: "redirected",
        p_redirect_url: payment.redirectUrl,
        p_gateway_payload: {
          business_name: businessName,
          plan_name: plan.name,
          billing_cycle: billingCycle,
          duration_months: durationMonths,
        },
      }
    );

    if (insertError) throw insertError;

    return json(res, 200, {
      data: {
        payment_id: subscriptionPaymentId,
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
