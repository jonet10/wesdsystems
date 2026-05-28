/**
 * Supabase Edge Function: send-confirmation-email
 * -----------------------------------------------------------------------------
 * Deploy as: supabase/functions/send-confirmation-email/index.ts
 *
 * Required secrets:
 * - RESEND_API_KEY
 * - RESEND_FROM_EMAIL (e.g. no-reply@yourdomain.com)
 */

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

interface Payload {
  to: string;
  full_name?: string;
  business_name?: string;
  temporary_password?: string;
  email_type?: "welcome" | "employee_account";
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!resendApiKey || !fromEmail) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY or RESEND_FROM_EMAIL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, full_name, business_name, temporary_password, email_type = "welcome" } = (await req.json()) as Payload;
    if (!to) {
      return new Response(JSON.stringify({ error: "Missing destination email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject = "Bienvenue sur Wesd Systems";
    let html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2>Bienvenue ${full_name ? full_name : ""} !</h2>
        <p>Votre compte a été créé avec succès sur Wesd Systems.</p>
        ${business_name ? `<p><strong>Entreprise:</strong> ${business_name}</p>` : ""}
        <p>Vous pouvez maintenant vous connecter à la plateforme.</p>
      </div>
    `;

    if (email_type === "employee_account") {
      subject = "Votre compte employé Wesd Systems";
      html = `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
          <h2>Votre compte employé est prêt</h2>
          <p>Votre administrateur a créé votre accès à Wesd Systems.</p>
          ${temporary_password ? `<p><strong>Mot de passe temporaire:</strong> ${temporary_password}</p>` : ""}
          <p>Merci de le changer après votre première connexion.</p>
        </div>
      `;
    }

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    if (!resendResp.ok) {
      const text = await resendResp.text();
      return new Response(JSON.stringify({ error: `Resend error: ${text}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
