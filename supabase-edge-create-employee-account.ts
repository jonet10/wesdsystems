/**
 * Supabase Edge Function: create-employee-account
 * -----------------------------------------------------------------------------
 * Deploy as: supabase/functions/create-employee-account/index.ts
 *
 * Purpose:
 * - Create employee auth account with temporary password
 * - Link auth user to business employee record in employee_accounts
 * - Set employee profile role to "employee"
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (origin: string | null) => {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin = origin && configured.includes(origin) ? origin : configured[0] || "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: callerAuth } = await callerClient.auth.getUser();
    const callerId = callerAuth.user?.id;
    if (!callerId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("id, business_id, role_normalized")
      .eq("id", callerId)
      .single();

    if (!callerProfile || !["studio_admin", "super_admin"].includes(callerProfile.role_normalized)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const payload = await req.json();
    const { employee_id, business_id, email, temporary_password, role = "employee", is_active = true } = payload;

    if (!employee_id || !business_id || !email || !temporary_password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    if (callerProfile.role_normalized !== "super_admin" && callerProfile.business_id !== business_id) {
      return new Response(JSON.stringify({ error: "Cross-tenant denied" }), { status: 403, headers: corsHeaders });
    }

    const { data: authCreated, error: authError } = await admin.auth.admin.createUser({
      email,
      password: temporary_password,
      email_confirm: true,
      user_metadata: { full_name: email.split("@")[0] },
    });

    if (authError || !authCreated.user) {
      return new Response(JSON.stringify({ error: authError?.message || "Auth create failed" }), { status: 400, headers: corsHeaders });
    }

    const authUserId = authCreated.user.id;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: authUserId,
      role: role,
      role_normalized: "employee",
      business_id: business_id,
      full_name: email.split("@")[0],
    });
    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: corsHeaders });
    }

    const { error: linkError } = await admin.from("employee_accounts").upsert({
      employee_id,
      business_id,
      auth_user_id: authUserId,
      is_active,
    });
    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), { status: 400, headers: corsHeaders });
    }

    // Optional: send employee account email via Resend if secrets exist
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (resendApiKey && fromEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "Votre compte employé Wesd Systems",
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
              <h2>Votre accès est prêt</h2>
              <p>Votre compte employé a été créé.</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Mot de passe temporaire:</strong> ${temporary_password}</p>
              <p>Merci de changer le mot de passe après la première connexion.</p>
            </div>
          `,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, auth_user_id: authUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
