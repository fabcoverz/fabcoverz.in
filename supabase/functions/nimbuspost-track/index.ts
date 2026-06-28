const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NimbusPost returns status_code like "PICKED", "IN TRANSIT" etc (uppercase full words)
// Map these to our short codes
function toStatusCode(raw: string): string {
  const s = (raw || "").toUpperCase().trim();
  if (s === "PICKED" || s === "PK")           return "PK";
  if (s === "PENDING PICKUP" || s === "PP")   return "PP";
  if (s === "IN TRANSIT" || s === "IT")       return "IT";
  if (s === "REACHED DESTINATION" || s === "RD") return "RD";
  if (s === "OUT FOR DELIVERY" || s === "OFD") return "OFD";
  if (s === "DELIVERED" || s === "DL")        return "DL";
  if (s.startsWith("RTO"))                    return "RT";
  // message-based fallback
  if (s.includes("PICKUP_COMPLETE") || s.includes("PICKUP"))  return "PK";
  if (s.includes("TRANSIT"))                  return "IT";
  if (s.includes("DELIVER"))                  return "DL";
  if (s.includes("OUT_FOR"))                  return "OFD";
  return "PP";
}

function formatTs(epochOrStr: string): string {
  if (!epochOrStr) return "";
  // Unix epoch (10 digits)
  if (/^\d{9,10}$/.test(epochOrStr.trim())) {
    return new Date(parseInt(epochOrStr) * 1000).toISOString();
  }
  return epochOrStr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { awb } = await req.json();
    const apiKey = Deno.env.get("NIMBUSPOST_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "NIMBUSPOST_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trackingAwb = awb?.trim();
    if (!trackingAwb) {
      return new Response(
        JSON.stringify({ success: false, error: "AWB number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nimbusRes = await fetch(
      `https://ship.nimbuspost.com/api/shipments/track_awb/${trackingAwb}`,
      { method: "GET", headers: { "NP-API-KEY": apiKey, "Content-Type": "application/json" } }
    );

    const raw = await nimbusRes.json();
    console.log("NimbusPost raw:", JSON.stringify(raw));

    if (!nimbusRes.ok || raw?.status === false) {
      return new Response(
        JSON.stringify({ success: false, error: raw?.message || "Tracking failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const d = raw?.data;

    // Current status from data.status (e.g. "picked")
    const currentStatusRaw = d?.status || "";

    // History array: [{ status_code, location, event_time, message }]
    const history: Record<string, string>[] = Array.isArray(d?.history) ? d.history : [];

    // Build events — newest first (already ordered by NimbusPost)
    const events = history.map((ev) => {
      const codeRaw = ev.status_code || ev.message || currentStatusRaw;
      return {
        status_code: toStatusCode(codeRaw),
        status:      ev.message || ev.status_code || "",
        location:    ev.location || "",
        timestamp:   formatTs(ev.event_time || ""),
      };
    });

    // If history empty, create single event from current status
    if (events.length === 0 && currentStatusRaw) {
      events.push({
        status_code: toStatusCode(currentStatusRaw),
        status:      currentStatusRaw,
        location:    "",
        timestamp:   "",
      });
    }

    return new Response(
      JSON.stringify({ success: true, awb: trackingAwb, tracking: { data: events } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
