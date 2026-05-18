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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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
