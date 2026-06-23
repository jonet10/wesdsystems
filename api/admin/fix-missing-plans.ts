import { apiSupabase, createClientWithAuth } from "../supabase.js";

const json = (res: any, status: number, payload: any) => {
  res.status(status).json(payload);
};

const SUPER_ADMIN_EMAILS = new Set(["admin@wesdsystems.store"]);

type BusinessRow = {
  id: string;
  name: string | null;
  plan_id: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  business_id: string;
  plan_id: string | null;
  created_at: string;
  status: string | null;
};

type PlanRow = {
  id: string;
  name: string;
  monthly_price: number;
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

    // Use authorized client to satisfy RLS policies
    const client = createClientWithAuth(token);

    const [
      { data: businesses, error: businessesError },
      { data: subscriptions, error: subscriptionsError },
      { data: plans, error: plansError }
    ] = await Promise.all([
      client.from("businesses").select("id, name, plan_id, created_at"),
      client.from("business_subscriptions").select("id, business_id, plan_id, created_at, status").order("created_at", { ascending: false }),
      client.from("subscription_plans").select("id, name, monthly_price").order("monthly_price", { ascending: true })
    ]);

    if (businessesError) throw businessesError;
    if (subscriptionsError) throw subscriptionsError;
    if (plansError) throw plansError;

    const businessRows = (businesses || []) as BusinessRow[];
    const subscriptionRows = (subscriptions || []) as SubscriptionRow[];
    const planRows = (plans || []) as PlanRow[];

    const defaultPlan = planRows[0] || { id: null, monthly_price: 0 };
    const latestPlanByBusiness = new Map<string, string>();
    const businessesWithSub = new Set<string>();

    for (const subscription of subscriptionRows) {
      if (!subscription.business_id) continue;
      businessesWithSub.add(subscription.business_id);
      if (subscription.plan_id && !latestPlanByBusiness.has(subscription.business_id)) {
        latestPlanByBusiness.set(subscription.business_id, subscription.plan_id);
      }
    }

    let createdSubscriptionsCount = 0;
    const newSubscriptions: any[] = [];
    const businessesToCreateSub = businessRows.filter(b => !businessesWithSub.has(b.id));

    for (const business of businessesToCreateSub) {
      const planId = business.plan_id || defaultPlan.id;
      if (!planId) continue;

      const matchedPlan = planRows.find(p => p.id === planId) || defaultPlan;
      const start = new Date(business.created_at || Date.now());
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day trial

      newSubscriptions.push({
        business_id: business.id,
        plan_id: planId,
        status: "trialing",
        billing_cycle: "monthly",
        price_snapshot: matchedPlan.monthly_price || 0,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        notes: "Généré automatiquement par l'outil de réparation"
      });
      businessesWithSub.add(business.id);
      latestPlanByBusiness.set(business.id, planId);
    }

    if (newSubscriptions.length > 0) {
      const { error: insertError } = await client.from("business_subscriptions").insert(newSubscriptions);
      if (insertError) throw insertError;
      createdSubscriptionsCount = newSubscriptions.length;
    }

    // Sync business.plan_id where missing
    const updates = businessRows
      .map((business) => {
        const currentPlan = business.plan_id || latestPlanByBusiness.get(business.id) || null;
        if (business.plan_id === currentPlan) return null;
        return { id: business.id, plan_id: currentPlan };
      })
      .filter(Boolean) as Array<{ id: string; plan_id: string }>;

    if (updates.length > 0) {
      const { error: updateError } = await client.from("businesses").upsert(updates, {
        onConflict: "id",
      });
      if (updateError) throw updateError;
    }

    return json(res, 200, {
      updated: updates.length,
      createdSubscriptions: createdSubscriptionsCount,
      message: `${createdSubscriptionsCount} abonnement(s) créé(s) et ${updates.length} plan(s) synchronisé(s).`,
    });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || "Erreur serveur" });
  }
}

