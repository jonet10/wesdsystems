import { apiSupabase } from "../supabase.js";

const json = (res: any, status: number, payload: any) => {
  res.status(status).json(payload);
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method not allowed" });
    }

    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return json(res, 401, { error: "Token d'authentification requis" });
    }

    const { data: authData, error: authError } = await apiSupabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return json(res, 401, { error: "Session invalide" });
    }

    const userId = authData.user.id;
    const body = req.body || {};

    const businessId = String(body.business_id || "");
    const planId = String(body.plan_id || "");
    const paymentMethod = String(body.payment_method || "");
    const amount = Number(body.amount || 0);
    const senderNumber = String(body.sender_number || "");
    const transactionReference = String(body.transaction_reference || "");
    const notes = String(body.notes || "");
    const proofImageUrl = body.proof_image_url ? String(body.proof_image_url) : null;

    if (!businessId) return json(res, 400, { error: "business_id requis" });
    if (!planId) return json(res, 400, { error: "plan_id requis" });
    if (!paymentMethod || !["moncash", "natcash"].includes(paymentMethod)) {
      return json(res, 400, { error: "payment_method doit être 'moncash' ou 'natcash'" });
    }
    if (amount <= 0) return json(res, 400, { error: "Le montant doit être supérieur à 0" });
    if (!transactionReference && !proofImageUrl) {
      return json(res, 400, { error: "Référence de transaction ou capture d'écran requise" });
    }

    const { data: profile, error: profileErr } = await apiSupabase
      .from("profiles")
      .select("business_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!profile) return json(res, 404, { error: "Profil introuvable" });

    const { data: plan, error: planErr } = await apiSupabase
      .from("subscription_plans")
      .select("id")
      .eq("id", planId)
      .maybeSingle();

    if (planErr) throw planErr;
    if (!plan) return json(res, 404, { error: "Plan introuvable" });

    const { data: payment, error: insertErr } = await apiSupabase
      .from("manual_payments")
      .insert({
        user_id: userId,
        business_id: businessId,
        plan_id: planId,
        payment_method: paymentMethod,
        amount,
        currency_code: "HTG",
        sender_number: senderNumber,
        transaction_reference: transactionReference,
        proof_image_url: proofImageUrl,
        notes: notes || null,
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (insertErr) throw insertErr;
    if (!payment) return json(res, 500, { error: "Impossible de créer le paiement" });

    try {
      const { data: businessRow } = await apiSupabase
        .from("businesses")
        .select("name")
        .eq("id", businessId)
        .maybeSingle();

      const businessName = businessRow?.name || "Un établissement";
      const methodLabel = paymentMethod === "moncash" ? "MonCash" : "NatCash";

      await apiSupabase.rpc("send_notification", {
        p_user_id: null,
        p_recipient_role: "super_admin",
        p_type: "manual_payment_request",
        p_title: "Nouvelle demande de paiement manuel",
        p_message: `${businessName} a soumis un paiement manuel de ${Number(amount).toLocaleString()} HTG via ${methodLabel}.`,
        p_metadata: {
          payment_id: payment.id,
          business_id: businessId,
          plan_id: planId,
          amount,
          payment_method: paymentMethod,
        },
      });
    } catch {
      // Notification failure should not block the payment submission
    }

    return json(res, 200, {
      data: {
        id: payment.id,
        status: "pending",
      },
    });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Impossible de soumettre le paiement" });
  }
}
