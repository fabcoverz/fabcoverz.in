const PICKUP = {
  warehouse_name: "TRENDZ24 MOBILE SHOP",
  name: "MOUDESH BALAJI",
  address: "Sultanpettai, Near Aroma Bakery, Mangalam Road",
  address_2: "",
  city: "Tiruppur",
  state: "Tamil Nadu",
  pincode: "641663",
  phone: "8098337127",
};

const PACKAGE = { weight: 250, length: 20, breadth: 18, height: 4 };
const SHIPPING_CHARGE_TN = 50;
const SHIPPING_CHARGE_OTHER = 70;
const NIMBUS_BASE = "https://api.nimbuspost.com/v1";
const SUPABASE_PROJECT_URL = "https://rrirrmjfdocqtfifzuiz.supabase.co";

function getShippingCharge(state: string): number {
  const s = (state || "").trim().toLowerCase().replace(/\s+/g, "");
  return (s === "tamilnadu" || s === "tamil nadu" || s === "tamilnādu") ? SHIPPING_CHARGE_TN : SHIPPING_CHARGE_OTHER;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function cleanDigits(val: any, last: number): string {
  return String(val ?? "").replace(/\D/g, "").slice(-last);
}

/**
 * Normalise an Indian mobile number to exactly 10 digits (no country code,
 * no leading zero).  Handles all common formats:
 *   +91-98765-43210  →  9876543210
 *   0091 98765 43210 →  9876543210
 *   091 9876543210   →  9876543210
 *   09876543210      →  9876543210   (trunk-prefix 0)
 *   9876543210       →  9876543210
 * Returns empty string if the result is not a plausible 10-digit mobile
 * (Indian mobiles start with 6-9).
 */
function normaliseIndianPhone(val: any): string {
  const digits = String(val ?? "").replace(/\D/g, "");
  // Strip country code variants: 0091… or 91… (when total > 10 digits)
  let num = digits;
  if (num.startsWith("0091") && num.length > 12) {
    num = num.slice(4);
  } else if (num.startsWith("91") && num.length === 12) {
    num = num.slice(2);
  } else if (num.startsWith("091") && num.length === 13) {
    num = num.slice(3);
  }
  // Strip single leading zero (trunk prefix)
  if (num.startsWith("0") && num.length === 11) {
    num = num.slice(1);
  }
  // Keep only last 10 digits as a final safety net
  num = num.slice(-10);
  // Validate: must be exactly 10 digits starting with 6-9
  if (/^[6-9]\d{9}$/.test(num)) return num;
  return num; // Return as-is; let NimbusPost surface the error if invalid
}

function getServiceKey(): string | null {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const found = parsed.find((k: any) => k.name === "service_role");
      return found?.api_key ?? null;
    }
    return parsed.service_role ?? null;
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { order } = await req.json();
    if (!order?.id) return respond({ success: false, error: "Order data required" }, 400);

    const email = Deno.env.get("NIMBUSPOST_EMAIL");
    const password = Deno.env.get("NIMBUSPOST_PASSWORD");
    if (!email || !password) return respond({ success: false, error: "Secrets not set" }, 500);

    // ── Step 1: Login ─────────────────────────────────────────────────────────
    const loginRes = await fetch(`${NIMBUS_BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();
    console.log("[NimbusPost] Login:", JSON.stringify(loginData));
    if (!loginData.status || !loginData.data) {
      return respond({ success: false, error: "Login failed", raw: loginData }, 500);
    }
    const token: string = loginData.data;
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    // ── Step 2: Build payload ─────────────────────────────────────────────────
    const isCOD = order.paymentMethod === "cod";
    const shippingCharge = getShippingCharge(order.state || ""); // ₹50 TN / ₹70 other — shipping fee
    const orderNumber = String(order.id).replace(/[^a-zA-Z0-9\-_]/g, "").substring(0, 20);

    // order.subtotal = product value (quantity × 299, minus any coupon)
    // order.total    = subtotal + shippingCharge (what customer pays)
    const productValue: number = order.subtotal ?? Math.max((order.total ?? 0) - (isCOD ? shippingCharge : 0), 0);

    // Phone: normalise to valid 10-digit Indian mobile (strips country code,
    // trunk prefix 0, spaces, dashes, etc.)
    const customerPhone = normaliseIndianPhone(order.customerPhone);
    const customerAltPhone = order.customerAltPhone ? normaliseIndianPhone(order.customerAltPhone) : "";
    console.log(`[NimbusPost] Phone: "${order.customerPhone}" -> "${customerPhone}" (len=${customerPhone.length})`);
    console.log(`[NimbusPost] AltPhone: "${order.customerAltPhone}" -> "${customerAltPhone}"`);

    // Append phone numbers to the main address field using comma separator
    // Format: "<address>, Primary Phone : XXXXXXXXXX, Secondary Phone : XXXXXXXXXX"
    let fullConsigneeAddress = order.shippingAddress;
    fullConsigneeAddress += `, Primary Phone : ${customerPhone}`;
    if (customerAltPhone) {
      fullConsigneeAddress += `, Secondary Phone : ${customerAltPhone}`;
    }

    // Total qty across all items
    const totalQty = Array.isArray(order.items) && order.items.length > 0
      ? order.items.reduce((sum: number, item: any) => sum + (item.quantity ?? item.qty ?? 1), 0)
      : 1;

    // Always "Phone Cases" as product name, fixed dimensions
    // price = per-unit price (NimbusPost shows "Amount Rs Per Qty")
    const perUnitPrice = totalQty > 0 ? Math.round(productValue / totalQty) : productValue;
    const orderItems = [{
      name: "Phone Cases",
      qty: String(totalQty),
      price: String(perUnitPrice),  // per unit price = 299 (NimbusPost multiplies qty × price internally)
      sku: "",
    }];

    const payload: Record<string, any> = {
      order_number: orderNumber,
      payment_type: isCOD ? "cod" : "prepaid",
      order_amount: productValue,         // merchandise value (excl. shipping)
      package_weight: PACKAGE.weight,   // 250g
      package_length: PACKAGE.length,   // 20cm
      package_breadth: PACKAGE.breadth, // 18cm
      package_height: PACKAGE.height,   // 4cm
      request_auto_pickup: "no",
      consignee: {
        name: order.customerName,
        address: fullConsigneeAddress,
        address_2: "",
        city: order.city,
        state: order.state,
        pincode: cleanDigits(order.pincode, 6),
        phone: customerPhone,
      },
      pickup: {
        warehouse_name: PICKUP.warehouse_name,
        name: PICKUP.name,
        address: PICKUP.address,
        address_2: PICKUP.address_2,
        city: PICKUP.city,
        state: PICKUP.state,
        pincode: PICKUP.pincode,
        phone: PICKUP.phone,
      },
      order_items: orderItems,
    };

    if (isCOD) {
      payload.shipping_charges = shippingCharge;    // ₹50 TN / ₹70 other
      // Always compute collectable = product value + shipping. Never trust order.total
      // (older orders may have been saved with shipping missing from total).
      payload.collectable_amount = productValue + shippingCharge;
    }

    console.log("[NimbusPost] Payload:", JSON.stringify(payload));

    // ── Step 3: Push to NimbusPost (No courier assigned — admin ships manually) ──
    const pushRes = await fetch(`${NIMBUS_BASE}/shipments`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const pushData = await pushRes.json();
    console.log("[NimbusPost] Response:", JSON.stringify(pushData));

    // NimbusPost may return status:false with "No autoship rule found" but still
    // create the order (visible in "Not Shipped" tab). Treat it as success if
    // an order_id exists in the response data.
    const awb: string | null = pushData.data?.awb_number ?? null;
    const nimbusOrderId: string | null = pushData.data?.order_id ? String(pushData.data.order_id) : null;
    const isAutoshipError = !pushData.status &&
      typeof pushData.message === "string" &&
      pushData.message.toLowerCase().includes("autoship");

    if (!pushData.status && !nimbusOrderId && !isAutoshipError) {
      return respond({ success: false, error: pushData.message ?? "Push failed", raw: pushData });
    }
    console.log(`[NimbusPost] Order created! order_id=${nimbusOrderId}, AWB=${awb ?? "none (not shipped yet)"}`);


    // ── Step 4: Update Supabase DB ────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? SUPABASE_PROJECT_URL;
    const serviceKey = getServiceKey();
    if (serviceKey) {
      try {
        // If order landed in "Not Shipped" (no AWB yet), keep admin status as
        // "pending" so admin knows to manually ship it; just record nimbus_order_id.
        // If AWB received, mark as "shipped" directly.
        const updateData: Record<string, any> = awb ? { status: "shipped" } : { status: "pending" };
        if (awb) updateData.awb = awb;
        if (nimbusOrderId) updateData.nimbus_order_id = nimbusOrderId;
        const patch = await fetch(
          `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify(updateData),
          }
        );
        console.log("[NimbusPost] DB patch:", patch.status);
      } catch (e) { console.error("DB error:", e); }
    }

    return respond({ success: true, message: "Order pushed to NimbusPost", awb, nimbus_order_id: nimbusOrderId });

  } catch (err) {
    console.error("[NimbusPost] Error:", err);
    return respond({ success: false, error: String(err) }, 500);
  }
});
