// ─────────────────────────────────────────────────────────────────────────────
// FabCoverz — Meta Pixel helper (Browser) + CAPI deduplication support
// Pixel ID: 939178782475549
// ─────────────────────────────────────────────────────────────────────────────

export const PIXEL_ID = "939178782475549";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

// ─── Generate unique event_id for deduplication ───────────────────────────────
// Both browser pixel and CAPI must send the SAME event_id so Meta deduplicates.
export function generateEventId(): string {
  return `fc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Read _fbp / _fbc cookies (improves Meta match rate) ─────────────────────
export function getFbCookies(): { fbp: string; fbc: string } {
  const cookies = document.cookie.split(";").reduce<Record<string, string>>((acc, c) => {
    const [k, v] = c.trim().split("=");
    acc[k] = v ?? "";
    return acc;
  }, {});
  return { fbp: cookies["_fbp"] ?? "", fbc: cookies["_fbc"] ?? "" };
}

// ─── Retry queue ──────────────────────────────────────────────────────────────
function fireWhenReady(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string,
  attempt = 0
): void {
  if (typeof window === "undefined") return;

  if (typeof window.fbq === "function") {
    if (params) {
      // Pass eventID for deduplication with CAPI
      window.fbq("track", eventName, params, eventId ? { eventID: eventId } : undefined);
    } else {
      window.fbq("track", eventName);
    }
    console.log(`[MetaPixel] Fired: ${eventName}`, params ?? "", eventId ? `eventID: ${eventId}` : "");
    return;
  }

  if (attempt < 25) {
    console.warn(`[MetaPixel] fbq not ready, retry ${attempt + 1}/25 for: ${eventName}`);
    setTimeout(() => fireWhenReady(eventName, params, eventId, attempt + 1), 200);
  } else {
    console.error(`[MetaPixel] FAILED after 5s — fbq never loaded. Event: ${eventName}`);
  }
}

/** Call on every route change */
export function trackPageView(): void {
  fireWhenReady("PageView");
}

/** Product page opened */
export function trackViewContent(params: {
  productId: string;
  productName: string;
  price: number;
}): void {
  fireWhenReady("ViewContent", {
    content_ids: [params.productId],
    content_name: params.productName,
    content_type: "product",
    value: params.price,
    currency: "INR",
  });
}

/** Item added to cart */
export function trackAddToCart(params: {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}): void {
  fireWhenReady("AddToCart", {
    content_ids: [params.productId],
    content_name: params.productName,
    content_type: "product",
    value: params.price * params.quantity,
    currency: "INR",
    num_items: params.quantity,
  });
}

/** Checkout page opened */
export function trackInitiateCheckout(params: {
  cartItems: Array<{ productId: string; price: number; quantity: number }>;
  total: number;
}): void {
  fireWhenReady("InitiateCheckout", {
    content_ids: params.cartItems.map((i) => i.productId),
    content_type: "product",
    num_items: params.cartItems.reduce((s, i) => s + i.quantity, 0),
    value: params.total,
    currency: "INR",
  });
}

/**
 * Payment success — fires browser pixel WITH eventID.
 * The same eventID must be passed to CAPI so Meta deduplicates both signals.
 * Returns the eventId so caller can pass it to the CAPI edge function.
 */
export function trackPurchase(params: {
  orderId: string;
  total: number;
  eventId: string;
  cartItems: Array<{
    productId: string;
    productName: string;
    price: number;
    quantity: number;
  }>;
}): void {
  fireWhenReady(
    "Purchase",
    {
      content_ids: params.cartItems.map((i) => i.productId),
      content_type: "product",
      num_items: params.cartItems.reduce((s, i) => s + i.quantity, 0),
      value: params.total,
      currency: "INR",
      order_id: params.orderId,
    },
    params.eventId
  );
}

/** Search performed */
export function trackSearch(searchString: string): void {
  fireWhenReady("Search", { search_string: searchString });
}
