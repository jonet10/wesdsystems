import { apiSupabase } from "../supabase.js";

const json = (res: any, status: number, payload: any) => {
  res.status(status).json(payload);
};

const SUPER_ADMIN_EMAILS = new Set(["admin@wesdsystems.store"]);

const verifySuperAdmin = async (token: string) => {
  if (!token) return null;
  const { data: authData, error: authError } = await apiSupabase.auth.getUser(token);
  if (authError || !authData?.user) return null;
  const user = authData.user;
  const metadataRole = user.user_metadata?.role_normalized ?? user.user_metadata?.role;
  const isSuperAdmin =
    SUPER_ADMIN_EMAILS.has(user.email ?? "") ||
    metadataRole === "super_admin" ||
    user.app_metadata?.role === "super_admin";
  if (isSuperAdmin) return user;
  const { data: profile } = await apiSupabase
    .from("profiles")
    .select("role, role_normalized")
    .eq("id", user.id)
    .maybeSingle();
  const profileRole = profile?.role_normalized || profile?.role;
  if (profileRole === "super_admin") return user;
  return null;
};

const verifyUser = async (token: string) => {
  if (!token) return null;
  const { data: authData, error: authError } = await apiSupabase.auth.getUser(token);
  return authError || !authData?.user ? null : authData.user;
};

async function handleSubmit(req: any, res: any, userId: string) {
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
  if (!["moncash", "natcash"].includes(paymentMethod)) {
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
      p_metadata: { payment_id: payment.id, business_id: businessId, plan_id: planId, amount, payment_method: paymentMethod },
    });
  } catch {}

  return json(res, 200, { data: { id: payment.id, status: "pending" } });
}

async function handleApprove(req: any, res: any, admin: any) {
  const body = req.body || {};
  const paymentId = String(body.payment_id || "");
  if (!paymentId) return json(res, 400, { error: "payment_id requis" });

  const { data: payment, error: paymentErr } = await apiSupabase
    .from("manual_payments")
    .select("id, user_id, business_id, plan_id, payment_method, amount, currency_code, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentErr) throw paymentErr;
  if (!payment) return json(res, 404, { error: "Paiement introuvable" });
  if (payment.status !== "pending") return json(res, 400, { error: "Ce paiement a déjà été traité" });

  const durationMonths = Math.max(1, Math.min(12, Number(body.duration_months || 1)));

  const { data: subResult, error: subError } = await apiSupabase.rpc("extend_or_create_subscription", {
    p_business_id: payment.business_id,
    p_plan_id: payment.plan_id,
    p_duration_months: durationMonths,
    p_amount: Number(payment.amount || 0),
    p_currency_code: payment.currency_code || "HTG",
    p_billing_cycle: durationMonths >= 12 ? "yearly" : "monthly",
    p_order_id: `manual_${payment.id.slice(0, 8)}_${Date.now()}`,
    p_notes: `Activé via paiement manuel ${payment.payment_method} · ${durationMonths} mois`,
  });
  if (subError) throw subError;
  if (!subResult?.success) throw new Error(subResult?.error || "Échec de l'activation de l'abonnement");

  const { error: approveErr } = await apiSupabase.rpc("approve_manual_payment", {
    p_payment_id: paymentId,
    p_approved_by: admin.id,
  });
  if (approveErr) throw approveErr;

  if (subResult.subscription_id) {
    await apiSupabase.from("manual_payments").update({ subscription_id: subResult.subscription_id }).eq("id", paymentId);
  }

  const { data: businessRow } = await apiSupabase
    .from("businesses")
    .select("name")
    .eq("id", payment.business_id)
    .maybeSingle();
  const businessName = businessRow?.name || "Votre établissement";
  const methodLabel = payment.payment_method === "moncash" ? "MonCash" : "NatCash";

  try {
    await apiSupabase.rpc("send_notification", {
      p_user_id: payment.user_id,
      p_recipient_role: null,
      p_type: "manual_payment_approved",
      p_title: "Paiement approuvé",
      p_message: `Votre paiement de ${Number(payment.amount).toLocaleString()} HTG via ${methodLabel} a été approuvé. Votre abonnement est maintenant actif.`,
      p_metadata: { payment_id: paymentId, business_id: payment.business_id, plan_id: payment.plan_id, amount: payment.amount, duration_months: durationMonths, subscription_id: subResult.subscription_id },
    });
  } catch {}

  return json(res, 200, {
    data: { ok: true, payment_id: paymentId, subscription_id: subResult.subscription_id, duration_months: durationMonths },
  });
}

async function handleReject(req: any, res: any, admin: any) {
  const body = req.body || {};
  const paymentId = String(body.payment_id || "");
  const reason = String(body.reason || "");

  if (!paymentId) return json(res, 400, { error: "payment_id requis" });
  if (!reason || reason.trim().length < 2) return json(res, 400, { error: "Une raison est requise pour le rejet" });

  const { data: payment, error: paymentErr } = await apiSupabase
    .from("manual_payments")
    .select("id, user_id, business_id, amount, payment_method, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentErr) throw paymentErr;
  if (!payment) return json(res, 404, { error: "Paiement introuvable" });
  if (payment.status !== "pending") return json(res, 400, { error: "Ce paiement a déjà été traité" });

  const { error: rejectErr } = await apiSupabase.rpc("reject_manual_payment", {
    p_payment_id: paymentId,
    p_rejected_by: admin.id,
    p_reason: reason.trim(),
  });
  if (rejectErr) throw rejectErr;

  const methodLabel = payment.payment_method === "moncash" ? "MonCash" : "NatCash";
  try {
    await apiSupabase.rpc("send_notification", {
      p_user_id: payment.user_id,
      p_recipient_role: null,
      p_type: "manual_payment_rejected",
      p_title: "Paiement rejeté",
      p_message: `Votre paiement de ${Number(payment.amount).toLocaleString()} HTG via ${methodLabel} a été rejeté. Raison : ${reason.trim()}`,
      p_metadata: { payment_id: paymentId, business_id: payment.business_id, amount: payment.amount, payment_method: payment.payment_method, reason: reason.trim() },
    });
  } catch {}

  return json(res, 200, { data: { ok: true, payment_id: paymentId, status: "rejected" } });
}

export default async function handler(req: any, res: any) {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(res, 401, { error: "Token d'authentification requis" });

    const path = req.url?.split("?")[0]?.replace(/\/+$/, "") || "";
    const action = path.split("/").pop();

    if (action === "submit" || action === "manual-payments") {
      const user = await verifyUser(token);
      if (!user) return json(res, 401, { error: "Session invalide" });
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleSubmit(req, res, user.id);
    }

    if (action === "approve" || action === "reject") {
      const admin = await verifySuperAdmin(token);
      if (!admin) return json(res, 403, { error: "Accès réservé aux administrateurs" });
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      if (action === "approve") return await handleApprove(req, res, admin);
      return await handleReject(req, res, admin);
    }

    return json(res, 404, { error: "Action inconnue. Utilisez /manual-payments/submit, /approve, ou /reject" });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}
