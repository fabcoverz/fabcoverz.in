const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { email, password } = await req.json();

    const SECRET_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    const SECRET_EMAIL    = Deno.env.get("ADMIN_EMAIL");

    if (!SECRET_PASSWORD) {
      return new Response(JSON.stringify({ ok: false, error: "Not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const passwordOk = password?.trim() === SECRET_PASSWORD.trim();

    // If ADMIN_EMAIL secret is set, also verify email. If not set, skip email check (backward compat).
    const emailOk = SECRET_EMAIL
      ? email?.trim().toLowerCase() === SECRET_EMAIL.trim().toLowerCase()
      : true;

    const ok = emailOk && passwordOk;

    return new Response(JSON.stringify({ ok }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
