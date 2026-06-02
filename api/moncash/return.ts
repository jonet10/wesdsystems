import { apiSupabase } from "../_supabase";
import { json } from "../pending-tabs/_shared";
import { MONCASH_PUBLIC_URLS } from "../../src/lib/moncash";
import { retrieveMonCashTransaction } from "./_service";

const addBillingCycle = (start: Date, billingCycle: string, durationMonths = 1) => {
  const next = new Date(start);
  if (billingCycle === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else if (billingCycle === "custom") {
    next.setMonth(next.getMonth() + Math.max(1, durationMonths));
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
};

const extractString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const findPaymentRecord = async (transactionId: string, orderId: string) => {
  let query = apiSupabase
    .from("moncash_subscription_payments")
    .select("id, business_id, subscription_id, plan_id, billing_cycle, amount, currency_code, order_id, transaction_id, status, redirect_url, gateway_payload, callback_payload, paid_at, confirmed_at, created_at, notes")
    .order("created_at", { ascending: false });

  if (transactionId) {
    const { data, error } = await query.eq("transaction_id", transactionId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (orderId) {
    const { data, error } = await query.eq("order_id", orderId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
};

const upsertSubscriptionActivation = async (payment: any, transaction: any) => {
  const today = new Date();
  const durationMonths = Math.max(1, Math.min(12, Number(payment.gateway_payload?.duration_months || 1)));
  const endDate = addBillingCycle(today, payment.billing_cycle || "monthly", durationMonths);
  const subscriptionPayload = {
    business_id: payment.business_id,
    plan_id: payment.plan_id,
    start_date: today.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
    status: "active",
    billing_cycle: payment.billing_cycle || "monthly",
    auto_renew: true,
    price_snapshot: Number(payment.amount || 0),
    currency_code: payment.currency_code || "HTG",
    notes: `MonCash ${payment.order_id}${transaction?.payment?.transaction_id ? ` · tx ${transaction.payment.transaction_id}` : ""} · ${durationMonths} mois`,
  };

  if (payment.subscription_id) {
    const { error } = await apiSupabase
      .from("business_subscriptions")
      .update(subscriptionPayload)
      .eq("id", payment.subscription_id);
    if (error) throw error;
    return payment.subscription_id;
  }

  const { data: existingSubscription, error: lookupError } = await apiSupabase
    .from("business_subscriptions")
    .select("id")
    .eq("business_id", payment.business_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existingSubscription?.id) {
    const { error } = await apiSupabase
      .from("business_subscriptions")
      .update(subscriptionPayload)
      .eq("id", existingSubscription.id);
    if (error) throw error;
    return existingSubscription.id;
  }

  const { data: inserted, error: insertError } = await apiSupabase
    .from("business_subscriptions")
    .insert(subscriptionPayload)
    .select("id")
    .single();
  if (insertError) throw insertError;
  return inserted.id;
};

export default async function handler(req: any, res: any) {
  try {
    const payload = req.method === "GET" ? req.query : req.body;
    const transactionId = extractString((payload as any)?.transaction_id || (payload as any)?.txn_id || (payload as any)?.id);
    const orderId = extractString((payload as any)?.order_id || (payload as any)?.reference || (payload as any)?.orderId);

    if (!transactionId && !orderId) {
      return json(res, 400, { error: "transactionId ou orderId requis" });
    }

    const paymentDetails = await retrieveMonCashTransaction({
      transactionId: transactionId || null,
      orderId: orderId || null,
    });

    const resolvedTransactionId = extractString(paymentDetails?.payment?.transaction_id || transactionId);
    const resolvedOrderId = extractString(paymentDetails?.payment?.reference || orderId);
    const paymentMessage = String(paymentDetails?.payment?.message || paymentDetails?.status || "").toLowerCase();
    const isSuccessful = paymentMessage.includes("successful") || String(paymentDetails?.status || "") === "200";

    const paymentRecord = await findPaymentRecord(resolvedTransactionId, resolvedOrderId);
    if (!paymentRecord) {
      return json(res, 404, { error: "Paiement MonCash introuvable" });
    }

    if (isSuccessful) {
      if (paymentRecord.status !== "successful") {
        const { error: paymentUpdateError } = await apiSupabase
          .from("moncash_subscription_payments")
          .update({
            transaction_id: resolvedTransactionId || paymentRecord.transaction_id,
            status: "successful",
            paid_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            callback_payload: paymentDetails,
          })
          .eq("id", paymentRecord.id);

        if (paymentUpdateError) throw paymentUpdateError;

        const subscriptionId = await upsertSubscriptionActivation(paymentRecord, paymentDetails);

        const { error: recordUpdateError } = await apiSupabase
          .from("moncash_subscription_payments")
          .update({
            subscription_id: subscriptionId,
            transaction_id: resolvedTransactionId || paymentRecord.transaction_id,
            status: "successful",
            paid_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            callback_payload: paymentDetails,
          })
          .eq("id", paymentRecord.id);

        if (recordUpdateError) throw recordUpdateError;

        const { error: businessUpdateError } = await apiSupabase
          .from("businesses")
          .update({ plan_id: paymentRecord.plan_id, status: "active" })
          .eq("id", paymentRecord.business_id);

        if (businessUpdateError) throw businessUpdateError;

        await apiSupabase.from("business_subscription_history").insert({
          business_id: paymentRecord.business_id,
          plan_id: paymentRecord.plan_id,
          previous_plan_id: paymentRecord.plan_id,
          action: paymentRecord.subscription_id ? "renewed" : "created",
          status_before: paymentRecord.status || "pending",
          status_after: "active",
          notes: `MonCash order ${paymentRecord.order_id}`,
        });
      }
    } else {
      await apiSupabase
        .from("moncash_subscription_payments")
        .update({
          transaction_id: resolvedTransactionId || paymentRecord.transaction_id,
          status: "failed",
          callback_payload: paymentDetails,
        })
        .eq("id", paymentRecord.id);
    }

    if (req.method === "GET" && req.query?.redirect !== "0") {
      const url = new URL(MONCASH_PUBLIC_URLS.alertUrl);
      url.searchParams.set("status", isSuccessful ? "success" : "failed");
      if (resolvedTransactionId) url.searchParams.set("transaction_id", resolvedTransactionId);
      if (resolvedOrderId) url.searchParams.set("reference", resolvedOrderId);
      return res.redirect(302, url.toString());
    }

    return json(res, 200, {
      data: {
        ok: true,
        status: isSuccessful ? "success" : "failed",
        transaction_id: resolvedTransactionId || null,
        reference: resolvedOrderId || null,
        alert_url: MONCASH_PUBLIC_URLS.alertUrl,
      },
    });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Impossible de traiter la notification MonCash" });
  }
}
