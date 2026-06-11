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

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method not allowed" });
    }

    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const admin = await verifySuperAdmin(token);
    if (!admin) {
      return json(res, 403, { error: "Accès réservé aux administrateurs" });
    }

    const body = req.body || {};
    const paymentId = String(body.payment_id || "");

    if (!paymentId) {
      return json(res, 400, { error: "payment_id requis" });
    }

    const { data: payment, error: paymentErr } = await apiSupabase
      .from("manual_payments")
      .select("id, user_id, business_id, plan_id, payment_method, amount, currency_code, status")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentErr) throw paymentErr;
    if (!payment) return json(res, 404, { error: "Paiement introuvable" });
    if (payment.status !== "pending") {
      return json(res, 400, { error: "Ce paiement a déjà été traité" });
    }

    const durationMonths = Math.max(1, Math.min(12, Number(body.duration_months || 1)));

    const { data: subResult, error: subError } = await apiSupabase.rpc(
      "extend_or_create_subscription",
      {
        p_business_id: payment.business_id,
        p_plan_id: payment.plan_id,
        p_duration_months: durationMonths,
        p_amount: Number(payment.amount || 0),
        p_currency_code: payment.currency_code || "HTG",
        p_billing_cycle: durationMonths >= 12 ? "yearly" : "monthly",
        p_order_id: `manual_${payment.id.slice(0, 8)}_${Date.now()}`,
        p_notes: `Activé via paiement manuel ${payment.payment_method} · ${durationMonths} mois`,
      }
    );

    if (subError) throw subError;
    if (!subResult?.success) {
      throw new Error(subResult?.error || "Échec de l'activation de l'abonnement");
    }

    const { error: approveErr } = await apiSupabase.rpc("approve_manual_payment", {
      p_payment_id: paymentId,
      p_approved_by: admin.id,
    });

    if (approveErr) throw approveErr;

    if (subResult.subscription_id) {
      await apiSupabase
        .from("manual_payments")
        .update({ subscription_id: subResult.subscription_id })
        .eq("id", paymentId);
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
        p_metadata: {
          payment_id: paymentId,
          business_id: payment.business_id,
          plan_id: payment.plan_id,
          amount: payment.amount,
          duration_months: durationMonths,
          subscription_id: subResult.subscription_id,
        },
      });
    } catch {
      // Notification failure should not block approval
    }

    return json(res, 200, {
      data: {
        ok: true,
        payment_id: paymentId,
        subscription_id: subResult.subscription_id,
        duration_months: durationMonths,
      },
    });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Impossible d'approuver le paiement" });
  }
}
