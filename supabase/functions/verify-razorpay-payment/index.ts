// ─────────────────────────────────────────────────────────────────────────────
// FabCoverz — Razorpay Verification + Auto NimbusPost Push
//
// Custom secrets needed (Dashboard → Edge Functions → Secrets):
//   RAZORPAY_KEY_SECRET  → already set ✓
//
// SUPABASE_URL is a built-in default secret — no need to add it.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_PROJECT_URL = "https://rrirrmjfdocqtfifzuiz.supabase.co";
const SUPABASE_ANON_KEY    = "sb_publishable_kUcYS_2OibJNFgfkYdWOXw_K67rH8Zh";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order, // optional — full Order object for auto NimbusPost push
    } = await req.json();

    // ── Step 1: Verify Razorpay HMAC ─────────────────────────────────────────
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!secret) {
      return respond({ verified: false, error: "RAZORPAY_KEY_SECRET not configured" }, 500);
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSig = createHmac("sha256", secret).update(body).digest("hex");
    const verified = expectedSig === razorpay_signature;

    if (!verified) {
      return respond({ verified: false });
    }

    // ── Step 2: Auto-push to NimbusPost (non-blocking) ────────────────────────
    let awb: string | null = null;
    let label: string | null = null;

    if (order) {
      try {
        // SUPABASE_URL is a built-in default secret available in all edge functions
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? SUPABASE_PROJECT_URL;

        const npRes = await fetch(
          `${supabaseUrl}/functions/v1/nimbuspost-create-shipment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ order }),
          }
        );
        const npData = await npRes.json();
        if (npData.success) {
          awb = npData.awb ?? null;
          label = npData.label ?? null;
        } else {
          console.error("NimbusPost push failed:", npData.error);
        }
      } catch (e) {
        // Must NOT block payment confirmation even if NimbusPost fails
        console.error("NimbusPost auto-push error:", e);
      }
    }

    return respond({ verified: true, awb, label });
  } catch (err) {
    return respond({ verified: false, error: String(err) }, 400);
  }
});
