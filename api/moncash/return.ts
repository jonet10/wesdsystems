import { apiSupabase } from "../supabase.js";
import { json } from "../pending-tabs/shared.js";
import { retrieveMonCashTransaction } from "./service.js";

const PUBLIC_URL = "https://wesdsystems.store";

const extractString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const findPaymentRecord = async (transactionId: string, orderId: string) => {
  const query = apiSupabase
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
  const durationMonths = Math.max(1, Math.min(12, Number(payment.gateway_payload?.duration_months || 1)));
  const notes = `MonCash ${payment.order_id}${transaction?.payment?.transaction_id ? ` · tx ${transaction.payment.transaction_id}` : ""} · ${durationMonths} mois`;

  const { data, error } = await apiSupabase.rpc("extend_or_create_subscription", {
    p_business_id: payment.business_id,
    p_plan_id: payment.plan_id,
    p_duration_months: durationMonths,
    p_amount: Number(payment.amount || 0),
    p_currency_code: payment.currency_code || "HTG",
    p_billing_cycle: payment.billing_cycle || "monthly",
    p_order_id: payment.order_id || null,
    p_notes: notes,
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Échec de l'activation de l'abonnement");

  return data.subscription_id;
};

export default async function handler(req: any, res: any) {
  try {
    const payload = req.method === "GET" ? req.query : req.body;
    const transactionId = extractString((payload as any)?.transaction_id || (payload as any)?.txn_id || (payload as any)?.id);
    const orderId = extractString((payload as any)?.order_id || (payload as any)?.reference || (payload as any)?.orderId);

    console.log(`[MonCash Return] Callback received. Method: ${req.method}, transactionId: ${transactionId}, orderId: ${orderId}`);

    if (!transactionId && !orderId) {
      console.warn(`[MonCash Return] Missing transactionId and orderId in payload:`, payload);
      return json(res, 400, { error: "transactionId ou orderId requis" });
    }

    console.log(`[MonCash Return] Calling retrieveMonCashTransaction...`);

    const paymentDetails = await retrieveMonCashTransaction({
      transactionId: transactionId || null,
      orderId: orderId || null,
    });

    const resolvedTransactionId = extractString(paymentDetails?.payment?.transaction_id || transactionId);
    const resolvedOrderId = extractString(paymentDetails?.payment?.reference || orderId);
    const paymentMessage = String(paymentDetails?.payment?.message || paymentDetails?.status || "").toLowerCase();
    const isSuccessful = paymentMessage.includes("successful") || String(paymentDetails?.status || "") === "200";

    console.log(`[MonCash Return] Payment validation: isSuccessful=${isSuccessful}, message=${paymentMessage}`);

    const paymentRecord = await findPaymentRecord(resolvedTransactionId, resolvedOrderId);
    if (!paymentRecord) {
      console.error(`[MonCash Return] Payment record not found for transactionId: ${resolvedTransactionId}, orderId: ${resolvedOrderId}`);
      return json(res, 404, { error: "Paiement MonCash introuvable" });
    }

    console.log(`[MonCash Return] Found payment record: ${paymentRecord.id}, current status: ${paymentRecord.status}`);

    if (isSuccessful) {
      if (paymentRecord.status !== "successful") {
          console.log(`[MonCash Return] Payment is new success. Activating subscription...`);
          const subscriptionId = await upsertSubscriptionActivation(paymentRecord, paymentDetails);
          console.log(`[MonCash Return] Subscription activated. ID: ${subscriptionId}`);

          const { error: paymentUpdateError } = await apiSupabase
            .from("moncash_subscription_payments")
            .update({
              transaction_id: resolvedTransactionId || paymentRecord.transaction_id,
              status: "successful",
              paid_at: new Date().toISOString(),
              confirmed_at: new Date().toISOString(),
              callback_payload: paymentDetails,
              subscription_id: subscriptionId,
            })
            .eq("id", paymentRecord.id);
          if (paymentUpdateError) throw paymentUpdateError;

        const { data: businessBefore, error: bizBeforeErr } = await apiSupabase
          .from("businesses")
          .select("plan_id")
          .eq("id", paymentRecord.business_id)
          .maybeSingle();
        if (bizBeforeErr) throw bizBeforeErr;
        const previousPlanId = businessBefore?.plan_id || null;

        const { error: businessUpdateError } = await apiSupabase
          .from("businesses")
          .update({ plan_id: paymentRecord.plan_id, status: "active" })
          .eq("id", paymentRecord.business_id);
        if (businessUpdateError) throw businessUpdateError;
        console.log(`[MonCash Return] Business status updated to active.`);

        await apiSupabase.from("business_subscription_history").insert({
          business_id: paymentRecord.business_id,
          plan_id: paymentRecord.plan_id,
          previous_plan_id: previousPlanId,
          action: paymentRecord.subscription_id ? "renewed" : "created",
          status_before: paymentRecord.status || "pending",
          status_after: "active",
          notes: `MonCash order ${paymentRecord.order_id}`,
        });

        const { data: businessName } = await apiSupabase
          .from("businesses")
          .select("name")
          .eq("id", paymentRecord.business_id)
          .maybeSingle();

        await apiSupabase.from("notifications").insert({
          recipient_role: "super_admin",
          type: "subscription_paid",
          title: "Paiement d'abonnement reçu",
          message: `${businessName?.name || "Un établissement"} a effectué son paiement d'abonnement et est en attente de validation.`,
          metadata: {
            business_id: paymentRecord.business_id,
            plan_id: paymentRecord.plan_id,
            amount: paymentRecord.amount,
            transaction_id: resolvedTransactionId,
            order_id: paymentRecord.order_id,
          },
        });

        await apiSupabase
          .from("subscription_payments")
          .update({
            status: "completed",
            transaction_id: resolvedTransactionId || paymentRecord.transaction_id,
            completed_at: new Date().toISOString(),
          })
          .eq("business_id", paymentRecord.business_id)
          .in("status", ["pending", "pending_verification"]);
          
        console.log(`[MonCash Return] Success flow completed successfully.`);
      } else {
        console.log(`[MonCash Return] Payment record was already marked as successful. Ignoring.`);
      }
    } else {
      console.log(`[MonCash Return] Payment is not successful (status: ${paymentMessage}). Marking as failed.`);
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
      const url = new URL(`${PUBLIC_URL}/moncash/confirmation`);
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
        alert_url: `${PUBLIC_URL}/moncash/confirmation`,
      },
    });
  } catch (error: any) {
    console.error(`[MonCash Return] Exception caught in handler:`, error);
    return json(res, 500, { error: error?.message || "Impossible de traiter la notification MonCash" });
  }
}
