/**
 * useVisitorTracking.ts  (ENHANCED v2)
 *
 * Changes vs v1:
 *  - Heartbeat reduced to 1s for near-real-time admin view
 *  - checkout_step field: tracks what the customer has filled so far
 *    { phone, name, email, address, pincode, payment_method }
 *  - checkout_fields: JSON of filled field names (for admin display)
 *  - page now includes "checkout" as a first-class value
 */

import { useEffect, useRef } from "react";

const SUPABASE_URL = "https://rrirrmjfdocqtfifzuiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyaXJybWpmZG9jcXRmaWZ6dWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTM5ODYsImV4cCI6MjA5NTUyOTk4Nn0.HySXwvFYB-94rbv_9Udveq-nUZP9QQriUNvjoKTfa18";

const HEARTBEAT_INTERVAL = 1_000; // 1 second (was 2s)

// ── Session ID ────────────────────────────────────────────────────────────────

function getSessionId(): string {
  let sid = sessionStorage.getItem("fc_visitor_sid");
  if (!sid) {
    sid = "v_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem("fc_visitor_sid", sid);
  }
  return sid;
}

// ── IP + Location (fetched once, cached in sessionStorage) ────────────────────

interface GeoInfo {
  ip: string;
  city: string;
  country: string;
}

let geoCache: GeoInfo | null = null;

async function fetchGeo(): Promise<GeoInfo> {
  if (geoCache) return geoCache;
  const cached = sessionStorage.getItem("fc_geo");
  if (cached) {
    try {
      geoCache = JSON.parse(cached);
      return geoCache!;
    } catch (_) {}
  }
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    geoCache = {
      ip:      data.ip      || "unknown",
      city:    data.city    || "unknown",
      country: data.country_name || data.country || "unknown",
    };
    sessionStorage.setItem("fc_geo", JSON.stringify(geoCache));
    return geoCache;
  } catch (_) {
    geoCache = { ip: "unknown", city: "unknown", country: "unknown" };
    return geoCache;
  }
}

// ── Supabase upsert ───────────────────────────────────────────────────────────

async function upsertSession(
  id: string,
  page: string,
  cartCount: number,
  geo?: GeoInfo,
  checkoutFields?: string[],
): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      id,
      page,
      cart_count: cartCount,
      last_seen: new Date().toISOString(),
    };
    if (geo) {
      body.ip_address = geo.ip;
      body.city       = geo.city;
      body.country    = geo.country;
    }
    // Store which checkout fields are filled (e.g. ["phone","name","address"])
    if (checkoutFields !== undefined) {
      body.checkout_fields = checkoutFields.length > 0 ? JSON.stringify(checkoutFields) : null;
    }
    await fetch(`${SUPABASE_URL}/rest/v1/visitor_sessions`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    });
  } catch (_) {
    // Non-critical
  }
}

// ── Reliable delete on tab close ──────────────────────────────────────────────

function deleteSessionBeacon(id: string): void {
  try {
    const body = JSON.stringify({ id, last_seen: new Date(0).toISOString() });
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(
      `${SUPABASE_URL}/rest/v1/visitor_sessions?id=eq.${encodeURIComponent(id)}&apikey=${SUPABASE_ANON_KEY}`,
      blob
    );
  } catch (_) {}

  try {
    fetch(`${SUPABASE_URL}/rest/v1/visitor_sessions?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      keepalive: true,
    });
  } catch (_) {}
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface VisitorTrackingOptions {
  page: string;
  cartCount: number;
  disabled?: boolean;
  /** List of checkout field names that are currently filled (only for checkout page) */
  checkoutFields?: string[];
}

export function useVisitorTracking({ page, cartCount, disabled, checkoutFields }: VisitorTrackingOptions): void {
  const sessionId = useRef(getSessionId());
  const pageRef   = useRef(page);
  const cartRef   = useRef(cartCount);
  const geoRef    = useRef<GeoInfo | undefined>(undefined);
  const fieldsRef = useRef<string[] | undefined>(checkoutFields);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { cartRef.current = cartCount; }, [cartCount]);
  useEffect(() => { fieldsRef.current = checkoutFields; }, [checkoutFields]);

  useEffect(() => {
    if (disabled) return;
    const sid = sessionId.current;

    fetchGeo().then(geo => {
      geoRef.current = geo;
      upsertSession(sid, pageRef.current, cartRef.current, geo, fieldsRef.current);
    });

    const interval = setInterval(() => {
      upsertSession(sid, pageRef.current, cartRef.current, undefined, fieldsRef.current);
    }, HEARTBEAT_INTERVAL);

    const handleUnload = () => deleteSessionBeacon(sid);
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
      deleteSessionBeacon(sid);
    };
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;
    upsertSession(sessionId.current, page, cartCount, geoRef.current, checkoutFields);
  }, [page, cartCount, disabled, checkoutFields]);
}

// ── Abandoned Cart helpers ────────────────────────────────────────────────────

export interface AbandonedCartData {
  sessionId: string;
  customerName: string;
  customerPhone: string;
  customerAltPhone?: string;
  customerEmail: string;
  city: string;
  state: string;
  pincode: string;
  items: unknown[];
  total: number;
}

export async function saveAbandonedCart(data: AbandonedCartData): Promise<void> {
  const now = new Date().toISOString();
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/abandoned_carts`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        id: data.sessionId,
        session_id: data.sessionId,
        customer_name:  data.customerName  || null,
        customer_phone: data.customerPhone || null,
        customer_email: data.customerEmail || null,
        city:    data.city    || null,
        state:   data.state   || null,
        pincode: data.pincode || null,
        items:   data.items,
        total:   data.total,
        updated_at: now,
      }),
    });
  } catch (_) {}
}

export async function deleteAbandonedCart(sessionId: string): Promise<void> {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/abandoned_carts?id=eq.${encodeURIComponent(sessionId)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
  } catch (_) {}
}

export function getVisitorSessionId(): string {
  return getSessionId();
}
