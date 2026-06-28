/**
 * LiveDashboard.tsx  (ENHANCED v2)
 * - 1s refresh (was 2s)
 * - Checkout page as a funnel step with field-level tracking
 * - Coin sound for new orders (replaces ding-dong)
 * - Activity feed: real-time per-visitor moves
 * - Checkout live count + field display
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Users, ShoppingCart, Home, Package, AlertTriangle,
  RefreshCw, MapPin, Phone, Mail, Globe, Clock, Layers, ChevronDown,
  ChevronUp, Wifi, WifiOff, ArrowRight, CreditCard, CheckCircle2, Activity
} from "lucide-react";

const SUPABASE_URL  = "https://rrirrmjfdocqtfifzuiz.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyaXJybWpmZG9jcXRmaWZ6dWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTM5ODYsImV4cCI6MjA5NTUyOTk4Nn0.HySXwvFYB-94rbv_9Udveq-nUZP9QQriUNvjoKTfa18";
const HEADERS       = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisitorSession {
  id: string;
  page: string;
  cart_count: number;
  last_seen: string;
  ip_address?: string;
  city?: string;
  country?: string;
  created_at?: string;
  checkout_fields?: string | null; // JSON array of filled field names
}

interface AbandonedCart {
  id: string;
  session_id?: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  items: { id: string; name: string; qty: number; price: number; model?: string; brand?: string }[] | null;
  total: number;
  updated_at: string;
  created_at?: string;
}

interface ActivityEvent {
  id: string;
  time: number;
  visitorId: string;
  type: "entered" | "page_change" | "cart_update" | "checkout_field" | "left";
  label: string;
  page?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  home:              { label: "Homepage",    icon: <Home className="w-4 h-4" />,        color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  product_detail:    { label: "Product",     icon: <Package className="w-4 h-4" />,      color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  collections:       { label: "Collections", icon: <Layers className="w-4 h-4" />,       color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  collection_detail: { label: "Collection",  icon: <Layers className="w-4 h-4" />,       color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  checkout:          { label: "Checkout",    icon: <CreditCard className="w-4 h-4" />,   color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  "/":               { label: "Homepage",    icon: <Home className="w-4 h-4" />,         color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
};
const DEFAULT_PAGE = { label: "Other", icon: <Globe className="w-4 h-4" />, color: "text-zinc-600", bg: "bg-zinc-50 border-zinc-200" };
function pageMeta(page: string) { return PAGE_META[page] || DEFAULT_PAGE; }

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)    return `${secs}s ago`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }); }
  catch { return "—"; }
}

// Parse checkout_fields JSON safely
function parseCheckoutFields(raw?: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// Human-readable field labels
const FIELD_LABELS: Record<string, { label: string; color: string }> = {
  phone:    { label: "Phone",   color: "bg-blue-100 text-blue-700" },
  name:     { label: "Name",    color: "bg-indigo-100 text-indigo-700" },
  email:    { label: "Email",   color: "bg-violet-100 text-violet-700" },
  address:  { label: "Address", color: "bg-orange-100 text-orange-700" },
  pincode:  { label: "Pincode", color: "bg-yellow-100 text-yellow-700" },
  city:     { label: "City",    color: "bg-cyan-100 text-cyan-700" },
};
function fieldBadge(f: string) {
  if (f.startsWith("payment:")) {
    const method = f.split(":")[1];
    return { label: `${method.toUpperCase()}`, color: "bg-green-100 text-green-700" };
  }
  return FIELD_LABELS[f] || { label: f, color: "bg-zinc-100 text-zinc-600" };
}

// ── Coin Sound ────────────────────────────────────────────────────────────────

function playCoinSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Coin: bright metallic ping at ~1200Hz with fast decay + harmonic overtone
    const playPing = (freq: number, delay: number, vol: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "triangle";
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.02);
    };
    // Three rapid coin pings
    playPing(1318, 0.00, 0.5, 0.18);
    playPing(1760, 0.06, 0.4, 0.14);
    playPing(2093, 0.12, 0.3, 0.12);
    playPing(1318, 0.22, 0.35, 0.20);
  } catch {}
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string; value: number; icon: React.ReactNode;
  color: string; bg: string; pulse?: boolean;
}> = ({ label, value, icon, color, bg, pulse }) => (
  <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${bg}`}>
    <div className="flex items-center justify-between">
      <span className={`${color} opacity-80`}>{icon}</span>
      {pulse && value > 0 && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
        </span>
      )}
    </div>
    <div>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <p className={`text-xs font-semibold mt-0.5 ${color} opacity-70 uppercase tracking-wider`}>{label}</p>
    </div>
  </div>
);

// ── Visitor Row (enhanced) ────────────────────────────────────────────────────

const VisitorRow: React.FC<{ v: VisitorSession }> = ({ v }) => {
  const meta = pageMeta(v.page);
  const secsAgo = Math.floor((Date.now() - new Date(v.last_seen).getTime()) / 1000);
  const checkoutFields = v.page === "checkout" ? parseCheckoutFields(v.checkout_fields) : [];
  const isInCheckout = v.page === "checkout";

  return (
    <div className={`flex flex-col gap-2 border rounded-xl px-4 py-3 mb-2 ${isInCheckout ? "border-green-200 bg-green-50/40" : "bg-white border-zinc-100"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${meta.bg} ${meta.color} shrink-0`}>
            {meta.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-zinc-800">{meta.label}</span>
              {v.cart_count > 0 && (
                <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  <ShoppingCart className="w-2.5 h-2.5" /> {v.cart_count}
                </span>
              )}
              {isInCheckout && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-200 text-green-800 animate-pulse">
                  IN CHECKOUT
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {(v.city || v.country) && (
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[v.city, v.country].filter(x => x && x !== "unknown").join(", ")}
                </span>
              )}
              {v.ip_address && v.ip_address !== "unknown" && (
                <span className="font-mono text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">{v.ip_address}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-400">{secsAgo}s ago</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </div>
      </div>

      {/* Checkout field progress */}
      {isInCheckout && (
        <div className="pl-11">
          {checkoutFields.length === 0 ? (
            <p className="text-[10px] text-zinc-400 italic">Just arrived at checkout...</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {checkoutFields.map(f => {
                const b = fieldBadge(f);
                return (
                  <span key={f} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.color}`}>
                    {b.label}
                  </span>
                );
              })}
              {checkoutFields.some(f => f.startsWith("payment:")) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Ready to Pay!
                </span>
              )}
            </div>
          )}
          <div className="mt-1.5 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (checkoutFields.length / 6) * 100)}%` }}
            />
          </div>
          <p className="text-[9px] text-zinc-400 mt-0.5">{checkoutFields.length}/6 fields filled</p>
        </div>
      )}
    </div>
  );
};

// ── Abandoned Cart Row ────────────────────────────────────────────────────────

const AbandonedRow: React.FC<{ ac: AbandonedCart }> = ({ ac }) => {
  const [expanded, setExpanded] = useState(false);
  const hasItems = ac.items && ac.items.length > 0;
  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden mb-3">
      <div className="bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-zinc-900">{ac.customer_name || "Anonymous"}</span>
              <span className="text-xs text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(ac.updated_at)}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {ac.customer_phone && (
                <a href={`tel:${ac.customer_phone}`} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                  <Phone className="w-3 h-3" /> {ac.customer_phone}
                </a>
              )}
              {ac.customer_email && (
                <a href={`mailto:${ac.customer_email}`} className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:underline truncate max-w-[200px]">
                  <Mail className="w-3 h-3" /> {ac.customer_email}
                </a>
              )}
            </div>
            {(ac.city || ac.state || ac.pincode) && (
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{[ac.city, ac.state].filter(Boolean).join(", ")}{ac.pincode && <span className="ml-1 font-mono font-bold text-zinc-700">PIN: {ac.pincode}</span>}</span>
              </div>
            )}
            {hasItems && (
              <div className="flex items-center gap-1 text-xs text-zinc-400">
                <ShoppingCart className="w-3 h-3" />
                <span>{ac.items!.map(i => i.name || i.id).slice(0, 2).join(", ")}
                  {ac.items!.length > 2 && <span className="text-zinc-300"> +{ac.items!.length - 2} more</span>}
                </span>
              </div>
            )}
          </div>
          <div className="shrink-0 text-right flex flex-col items-end gap-2">
            <span className="text-lg font-black text-zinc-900">₹{ac.total}</span>
            <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{ac.items?.length || 0} item{(ac.items?.length || 0) !== 1 ? "s" : ""}</span>
            {hasItems && (
              <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors">
                {expanded ? <><ChevronUp className="w-3 h-3" /> Hide</> : <><ChevronDown className="w-3 h-3" /> Details</>}
              </button>
            )}
          </div>
        </div>
      </div>
      {expanded && hasItems && (
        <div className="bg-zinc-50 border-t border-zinc-100 px-5 py-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Cart Items</p>
          {ac.items!.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2 border border-zinc-100">
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-800 truncate">{item.name || item.id}</p>
                {(item.brand || item.model) && <p className="text-[10px] text-zinc-400">{[item.brand, item.model].filter(Boolean).join(" · ")}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-3 text-xs font-semibold text-zinc-600">
                <span className="bg-zinc-100 px-2 py-0.5 rounded">×{item.qty}</span>
                <span className="text-zinc-900 font-black">₹{item.price * item.qty}</span>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-1 border-t border-zinc-200 mt-2">
            <span className="text-sm font-black text-zinc-900">Total: ₹{ac.total}</span>
          </div>
          <p className="text-[10px] text-zinc-300 text-right">
            Last updated: {formatTime(ac.updated_at)}
            {ac.created_at && ` · Created: ${formatTime(ac.created_at)}`}
          </p>
        </div>
      )}
    </div>
  );
};

// ── Activity Feed ─────────────────────────────────────────────────────────────

const ActivityFeed: React.FC<{ events: ActivityEvent[] }> = ({ events }) => {
  if (events.length === 0) return (
    <div className="text-center py-8">
      <Activity className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
      <p className="text-sm text-zinc-400">Activity will appear here in real-time</p>
    </div>
  );
  return (
    <div className="space-y-1 max-h-72 overflow-y-auto">
      {events.map(ev => (
        <div key={ev.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-100">
          <span className="text-[10px] font-mono text-zinc-400 shrink-0 mt-0.5">
            {new Date(ev.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </span>
          <span className="text-xs text-zinc-700 leading-snug">{ev.label}</span>
        </div>
      ))}
    </div>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export const LiveDashboard: React.FC = () => {
  const [visitors,     setVisitors]     = useState<VisitorSession[]>([]);
  const [abandoned,    setAbandoned]    = useState<AbandonedCart[]>([]);
  const [dailyCount,   setDailyCount]   = useState<number | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [lastRefresh,  setLastRefresh]  = useState<Date>(new Date());
  const [connected,    setConnected]    = useState(true);
  const [activeTab,    setActiveTab]    = useState<"visitors" | "abandoned" | "activity">("visitors");
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);

  // Track previous visitor state to generate activity events
  const prevVisitorsRef = useRef<VisitorSession[]>([]);
  const prevCheckoutRef = useRef<Map<string, string[]>>(new Map());

  const addActivity = useCallback((ev: Omit<ActivityEvent, "id" | "time">) => {
    setActivityFeed(prev => [
      { ...ev, id: Math.random().toString(36).slice(2), time: Date.now() },
      ...prev.slice(0, 49), // keep last 50
    ]);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const cutoff = new Date(Date.now() - 4_000).toISOString(); // 4s cutoff (1s heartbeat × 4 = safe)
      const todayCutoff = new Date(); todayCutoff.setHours(0, 0, 0, 0);

      const [vsRes, acRes, dvRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/visitor_sessions?select=*&last_seen=gte.${cutoff}&order=last_seen.desc`, { headers: HEADERS }),
        fetch(`${SUPABASE_URL}/rest/v1/abandoned_carts?select=*&order=updated_at.desc`, { headers: HEADERS }),
        fetch(`${SUPABASE_URL}/rest/v1/visitor_sessions?select=id&created_at=gte.${todayCutoff.toISOString()}`, {
          headers: { ...HEADERS, Prefer: "count=exact" }
        }),
      ]);

      if (!vsRes.ok || !acRes.ok) throw new Error(`HTTP ${vsRes.status} / ${acRes.status}`);

      const vsData: VisitorSession[] = await vsRes.json();
      const acData: AbandonedCart[]  = await acRes.json();

      const myId = sessionStorage.getItem("fc_visitor_sid");
      const filtered = vsData.filter(v => v.id !== myId);

      // ── Generate activity events ──────────────────────────────────────────
      const prevIds  = new Set(prevVisitorsRef.current.map(v => v.id));
      const freshIds = new Set(filtered.map(v => v.id));

      // New visitors
      filtered.filter(v => !prevIds.has(v.id)).forEach(v => {
        addActivity({ visitorId: v.id, type: "entered", page: v.page, label: `New visitor arrived → ${pageMeta(v.page).label}${v.city && v.city !== "unknown" ? ` (${v.city})` : ""}` });
      });

      // Left visitors
      prevVisitorsRef.current.filter(v => !freshIds.has(v.id)).forEach(v => {
        addActivity({ visitorId: v.id, type: "left", page: v.page, label: `Visitor left from ${pageMeta(v.page).label}` });
      });

      // Page changes
      filtered.forEach(v => {
        const prev = prevVisitorsRef.current.find(p => p.id === v.id);
        if (prev && prev.page !== v.page) {
          addActivity({ visitorId: v.id, type: "page_change", page: v.page, label: `Visitor moved: ${pageMeta(prev.page).label} → ${pageMeta(v.page).label}` });
        }
        // Cart updates
        if (prev && prev.cart_count !== v.cart_count) {
          if (v.cart_count > prev.cart_count) {
            addActivity({ visitorId: v.id, type: "cart_update", page: v.page, label: `Added to cart (now ${v.cart_count} item${v.cart_count !== 1 ? "s" : ""})` });
          } else {
            addActivity({ visitorId: v.id, type: "cart_update", page: v.page, label: `Removed from cart (now ${v.cart_count} item${v.cart_count !== 1 ? "s" : ""})` });
          }
        }
        // Checkout field updates
        if (v.page === "checkout") {
          const currentFields = parseCheckoutFields(v.checkout_fields);
          const prevFields = prevCheckoutRef.current.get(v.id) || [];
          const newFields = currentFields.filter(f => !prevFields.includes(f));
          newFields.forEach(f => {
            const b = fieldBadge(f);
            addActivity({ visitorId: v.id, type: "checkout_field", page: "checkout", label: `Customer filled: ${b.label.replace(/^[^\w]*/, "")}` });
          });
          prevCheckoutRef.current.set(v.id, currentFields);
        }
      });

      // Clean up checkout cache for gone visitors
      prevVisitorsRef.current.filter(v => !freshIds.has(v.id)).forEach(v => {
        prevCheckoutRef.current.delete(v.id);
      });

      prevVisitorsRef.current = filtered;
      setVisitors(filtered);
      setAbandoned(acData);

      const cr = dvRes.headers.get("content-range");
      if (cr) { const n = parseInt(cr.split("/")[1]); if (!isNaN(n)) setDailyCount(n); }
      else { const d: { id: string }[] = await dvRes.json(); setDailyCount(d.length); }

      setError(null);
      setConnected(true);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e?.message || String(e));
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [addActivity]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 1_000); // 1s refresh
    return () => clearInterval(iv);
  }, [fetchData]);

  // Page breakdown
  const pageCounts = visitors.reduce<Record<string, number>>((acc, v) => {
    const key = v.page === "/" ? "home" : v.page;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const homeCnt       = pageCounts["home"]              || 0;
  const productCnt    = pageCounts["product_detail"]    || 0;
  const collectionCnt = (pageCounts["collections"] || 0) + (pageCounts["collection_detail"] || 0);
  const checkoutCnt   = pageCounts["checkout"]          || 0;

  const abandonedToday = abandoned.filter(ac => {
    const age = Date.now() - new Date(ac.updated_at).getTime();
    return age < 86_400_000;
  }).length;

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-sans">
      {/* Header */}
      <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${connected ? "bg-green-400" : "bg-red-400"} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${connected ? "bg-green-500" : "bg-red-500"}`}></span>
          </span>
          <span className="text-lg font-black tracking-tight">FabCoverz Live Dashboard</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${connected ? "bg-green-900/60 text-green-300" : "bg-red-900/60 text-red-300"}`}>
            {connected ? <><Wifi className="w-3 h-3" /> LIVE</> : <><WifiOff className="w-3 h-3" /> OFFLINE</>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">Refreshes every 1s · Last: {lastRefresh.toLocaleTimeString("en-IN")}</span>
          <button onClick={fetchData} className={`p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors ${loading ? "animate-spin" : ""}`}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">Could not fetch live data</p>
              <p className="text-xs text-red-600 font-mono mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Live Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Online Now"       value={visitors.length}  icon={<Users className="w-5 h-5" />}        color="text-green-700"   bg="bg-green-50 border-green-200"   pulse />
            <StatCard label="Today's Visitors" value={dailyCount ?? 0}  icon={<Globe className="w-5 h-5" />}        color="text-blue-700"    bg="bg-blue-50 border-blue-200" />
            <StatCard label="On Homepage"      value={homeCnt}          icon={<Home className="w-5 h-5" />}         color="text-indigo-700"  bg="bg-indigo-50 border-indigo-200" />
            <StatCard label="On Product"       value={productCnt}       icon={<Package className="w-5 h-5" />}      color="text-purple-700"  bg="bg-purple-50 border-purple-200" />
            <StatCard label="In Checkout"      value={checkoutCnt}      icon={<CreditCard className="w-5 h-5" />}   color="text-green-700"   bg="bg-green-50 border-green-200"   pulse />
            <StatCard label="Abandoned Today"  value={abandonedToday}   icon={<AlertTriangle className="w-5 h-5" />} color="text-red-700"   bg="bg-red-50 border-red-200" />
          </div>
        </div>

        {/* Funnel */}
        {visitors.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Live Sales Funnel</h2>
            <div className="flex flex-wrap gap-3 items-center">
              {[
                { key: "home",           label: "Homepage",    cnt: homeCnt,       color: "bg-blue-500" },
                { key: "collections",    label: "Collections", cnt: collectionCnt, color: "bg-amber-500" },
                { key: "product_detail", label: "Product",     cnt: productCnt,    color: "bg-purple-500" },
                { key: "checkout",       label: "Checkout",    cnt: checkoutCnt,   color: "bg-green-500" },
              ].map((step, i, arr) => (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1 min-w-[80px]">
                    <div className={`text-white text-xl font-black w-14 h-14 rounded-2xl flex items-center justify-center ${step.color}`}>
                      {step.cnt}
                    </div>
                    <span className="text-xs font-semibold text-zinc-500">{step.label}</span>
                    {i > 0 && arr[i-1].cnt > 0 && step.cnt > 0 && (
                      <span className="text-[9px] text-zinc-400">{Math.round((step.cnt / arr[i-1].cnt) * 100)}%</span>
                    )}
                  </div>
                  {i < arr.length - 1 && <div className="flex items-center text-zinc-300 self-center"><ArrowRight className="w-5 h-5" /></div>}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="flex items-center border-b border-zinc-100 px-6 py-3 gap-2 flex-wrap">
            {([
              { key: "visitors",  label: `Visitors (${visitors.length})` },
              { key: "abandoned", label: `Abandoned (${abandoned.length})` },
              { key: "activity",  label: `Activity Feed` },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === t.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Visitors Tab */}
            {activeTab === "visitors" && (
              visitors.length === 0 ? (
                <div className="text-center py-16">
                  <Globe className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-zinc-400">No active visitors right now</p>
                  <p className="text-xs text-zinc-300 mt-1">Auto-refreshes every 1 second</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-zinc-400 font-semibold">{visitors.length} visitor{visitors.length !== 1 ? "s" : ""} on site</p>
                    {checkoutCnt > 0 && (
                      <span className="text-xs font-bold px-3 py-1 bg-green-100 text-green-700 rounded-full animate-pulse">
                        {checkoutCnt} in checkout right now!
                      </span>
                    )}
                  </div>
                  {visitors.map(v => <VisitorRow key={v.id} v={v} />)}
                </div>
              )
            )}

            {/* Abandoned Tab */}
            {activeTab === "abandoned" && (
              abandoned.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-zinc-400">No abandoned carts</p>
                  <p className="text-xs text-zinc-300 mt-1">Saved when customers fill address but don't complete payment</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-zinc-400 mb-4 font-semibold">{abandoned.length} abandoned cart{abandoned.length !== 1 ? "s" : ""}</p>
                  {abandoned.map(ac => <AbandonedRow key={ac.id} ac={ac} />)}
                </div>
              )
            )}

            {/* Activity Feed Tab */}
            {activeTab === "activity" && <ActivityFeed events={activityFeed} />}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-300 pb-4">FabCoverz Admin · Live Dashboard · Refreshes every 1s</p>
      </div>
    </div>
  );
};
