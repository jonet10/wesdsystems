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
    const reason = String(body.reason || "");

    if (!paymentId) {
      return json(res, 400, { error: "payment_id requis" });
    }

    if (!reason || reason.trim().length < 2) {
      return json(res, 400, { error: "Une raison est requise pour le rejet" });
    }

    const { data: payment, error: paymentErr } = await apiSupabase
      .from("manual_payments")
      .select("id, user_id, business_id, amount, payment_method, status")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentErr) throw paymentErr;
    if (!payment) return json(res, 404, { error: "Paiement introuvable" });
    if (payment.status !== "pending") {
      return json(res, 400, { error: "Ce paiement a déjà été traité" });
    }

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
        p_metadata: {
          payment_id: paymentId,
          business_id: payment.business_id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          reason: reason.trim(),
        },
      });
    } catch {
      // Notification failure should not block rejection
    }

    return json(res, 200, {
      data: {
        ok: true,
        payment_id: paymentId,
        status: "rejected",
      },
    });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Impossible de rejeter le paiement" });
  }
}
