// ─────────────────────────────────────────────────────────────────────────────
// FabCoverz — Meta Conversions API (CAPI) Edge Function
// Fires server-side Purchase events to Meta — deduplicated with browser pixel.
//
// Required secrets in Supabase Dashboard → Edge Functions → Secrets:
//   META_PIXEL_ID       → Your Pixel ID  (e.g. 939178782475549)
//   META_ACCESS_TOKEN   → Meta System User Access Token (from Events Manager)
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CAPIPayload {
  eventName: string;       // "Purchase"
  eventId: string;         // Same event_id sent from browser pixel — for deduplication
  eventTime: number;       // Unix timestamp (seconds)
  orderId: string;
  total: number;
  currency: string;
  contentIds: string[];
  numItems: number;
  // Customer info (hashed server-side for better match rate)
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  // Client info
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;            // _fbp cookie value
  fbc?: string;            // _fbc cookie value
}

/** SHA-256 hash a string (Meta requires hashed PII) */
async function sha256(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  const msgBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID");
    const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");

    if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
      console.error("[CAPI] Missing META_PIXEL_ID or META_ACCESS_TOKEN secret");
      return new Response(
        JSON.stringify({ error: "CAPI secrets not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: CAPIPayload = await req.json();

    const {
      eventName,
      eventId,
      eventTime,
      orderId,
      total,
      currency,
      contentIds,
      numItems,
      customerEmail,
      customerPhone,
      customerName,
      clientIpAddress,
      clientUserAgent,
      fbp,
      fbc,
    } = payload;

    // ── Build user_data (PII must be SHA-256 hashed) ──────────────────────────
    const userData: Record<string, string | string[]> = {};

    if (customerEmail) {
      userData["em"] = await sha256(customerEmail);
    }
    if (customerPhone) {
      // Remove non-digits, add country code if missing
      const cleaned = customerPhone.replace(/\D/g, "");
      const withCountry = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
      userData["ph"] = await sha256(withCountry);
    }
    if (customerName) {
      const parts = customerName.trim().split(" ");
      userData["fn"] = await sha256(parts[0] || "");
      if (parts.length > 1) {
        userData["ln"] = await sha256(parts.slice(1).join(" "));
      }
    }
    if (clientIpAddress) userData["client_ip_address"] = clientIpAddress;
    if (clientUserAgent) userData["client_user_agent"] = clientUserAgent;
    if (fbp) userData["fbp"] = fbp;
    if (fbc) userData["fbc"] = fbc;

    // ── Build CAPI event payload ───────────────────────────────────────────────
    const capiEvent = {
      data: [
        {
          event_name: eventName,
          event_time: eventTime || Math.floor(Date.now() / 1000),
          event_id: eventId,                // Deduplication key — must match browser pixel event_id
          event_source_url: "https://fabcoverz.store",
          action_source: "website",
          user_data: userData,
          custom_data: {
            currency: currency || "INR",
            value: total,
            content_ids: contentIds,
            content_type: "product",
            num_items: numItems,
            order_id: orderId,
          },
        },
      ],
    };

    const capiUrl = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;

    const capiRes = await fetch(capiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(capiEvent),
    });

    const capiData = await capiRes.json();

    if (!capiRes.ok) {
      console.error("[CAPI] Meta API error:", JSON.stringify(capiData));
      return new Response(
        JSON.stringify({ error: "Meta CAPI call failed", detail: capiData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CAPI] ✅ ${eventName} fired — event_id: ${eventId} | order: ${orderId} | value: ₹${total}`);

    return new Response(
      JSON.stringify({ success: true, meta: capiData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[CAPI] Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
