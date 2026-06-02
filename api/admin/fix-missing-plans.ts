import { apiSupabase } from "../_supabase";

const json = (res: any, status: number, payload: any) => {
  res.status(status).json(payload);
};

const SUPER_ADMIN_EMAILS = new Set(["admin@wesdsystems.store"]);

type BusinessRow = {
  id: string;
  plan_id: string | null;
};

type SubscriptionRow = {
  business_id: string;
  plan_id: string | null;
  created_at: string;
  status: string | null;
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

    const user = authData.user;
    const metadataRole = user.user_metadata?.role_normalized ?? user.user_metadata?.role;
    const isSuperAdmin =
      SUPER_ADMIN_EMAILS.has(user.email ?? "") ||
      metadataRole === "super_admin" ||
      user.app_metadata?.role === "super_admin";

    if (!isSuperAdmin) {
      const { data: profile, error: profileError } = await apiSupabase
        .from("profiles")
        .select("role, role_normalized")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const profileRole = profile?.role_normalized || profile?.role;
      if (profileRole !== "super_admin") {
        return json(res, 403, { error: "Accès refusé" });
      }
    }

    const [{ data: businesses, error: businessesError }, { data: subscriptions, error: subscriptionsError }] =
      await Promise.all([
        apiSupabase.from("businesses").select("id, plan_id"),
        apiSupabase
          .from("business_subscriptions")
          .select("business_id, plan_id, created_at, status")
          .order("created_at", { ascending: false }),
      ]);

    if (businessesError) throw businessesError;
    if (subscriptionsError) throw subscriptionsError;

    const businessRows = (businesses || []) as BusinessRow[];
    const subscriptionRows = (subscriptions || []) as SubscriptionRow[];

    const latestPlanByBusiness = new Map<string, string>();
    for (const subscription of subscriptionRows) {
      if (!subscription.business_id || !subscription.plan_id) continue;
      if (!latestPlanByBusiness.has(subscription.business_id)) {
        latestPlanByBusiness.set(subscription.business_id, subscription.plan_id);
      }
    }

    const missingBusinesses = businessRows.filter((business) => {
      const currentPlan = business.plan_id || latestPlanByBusiness.get(business.id) || null;
      return !currentPlan;
    });

    const updates = missingBusinesses
      .map((business) => {
        const planId = latestPlanByBusiness.get(business.id);
        if (!planId) return null;
        return { id: business.id, plan_id: planId };
      })
      .filter(Boolean) as Array<{ id: string; plan_id: string }>;

    if (updates.length === 0) {
      return json(res, 200, {
        updated: 0,
        skipped: missingBusinesses.length,
        missing: missingBusinesses.length,
        message: "Aucun plan manquant à corriger",
      });
    }

    const { error: updateError } = await apiSupabase.from("businesses").upsert(updates, {
      onConflict: "id",
    });

    if (updateError) throw updateError;

    return json(res, 200, {
      updated: updates.length,
      skipped: missingBusinesses.length - updates.length,
      missing: missingBusinesses.length,
      message: `${updates.length} établissement(s) corrigé(s)`,
    });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}
