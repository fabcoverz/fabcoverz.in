import React, { useState } from "react";
import { Package, Search, MapPin, Clock, Truck, Home, AlertCircle, ArrowLeft, RotateCcw, CheckCircle2, XCircle } from "lucide-react";

const SUPABASE_URL = "https://rrirrmjfdocqtfifzuiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyaXJybWpmZG9jcXRmaWZ6dWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTM5ODYsImV4cCI6MjA5NTUyOTk4Nn0.HySXwvFYB-94rbv_9Udveq-nUZP9QQriUNvjoKTfa18";
const TRACK_FN_URL = `${SUPABASE_URL}/functions/v1/nimbuspost-track`;

// NimbusPost status code → display label
const STATUS_MAP: Record<string, string> = {
  PP:      "Pending Pickup",
  PK:      "Picked",
  IT:      "In Transit",
  RD:      "Reached Destination",
  EX:      "Exception",
  OFD:     "Out for Delivery",
  DL:      "Delivered",
  RT:      "RTO Initiated",
  "RT-IT": "RTO In Transit",
  "RT-DL": "RTO Delivered",
};

// Step progression (normal delivery)
const STEPS = [
  { code: "PP",  label: "Pending Pickup",       icon: Package },
  { code: "PK",  label: "Picked",               icon: Truck },
  { code: "IT",  label: "In Transit",           icon: Truck },
  { code: "RD",  label: "Reached Destination",  icon: MapPin },
  { code: "OFD", label: "Out for Delivery",     icon: MapPin },
  { code: "DL",  label: "Delivered",            icon: Home },
];

function getStepIndex(code: string): number {
  if (code === "DL")  return 5;
  if (code === "OFD") return 4;
  if (code === "RD")  return 3;
  if (code === "IT")  return 2;
  if (code === "PK")  return 1;
  if (code === "PP")  return 0;
  return -1; // EX, RT variants — don't highlight steps
}

function formatTs(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ts; }
}

interface TrackingEvent {
  status_code: string;
  status: string;
  location: string;
  timestamp: string;
}

interface Props { onGoBack: () => void; }

export const TrackOrderPage: React.FC<Props> = ({ onGoBack }) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [awbResult, setAwbResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async () => {
    const val = input.trim();
    if (!val) return;
    setLoading(true);
    setError(null);
    setEvents([]);
    setCurrentCode(null);
    setAwbResult(null);

    try {
      const res = await fetch(TRACK_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ awb: val }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Tracking failed");

      // Parse NimbusPost response — data.tracking.data is array of events
      const raw = data.tracking;
      // NimbusPost old API returns: { status: true, data: [ { status_code, status, location, timestamp }, ... ] }
      const rawEvents: TrackingEvent[] = Array.isArray(raw?.data) ? raw.data : [];

      setEvents(rawEvents);
      setCurrentCode(rawEvents[0]?.status_code || null);
      setAwbResult(data.awb);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentStep = currentCode ? getStepIndex(currentCode) : -1;
  const isRTO = currentCode?.startsWith("RT");
  const isException = currentCode === "EX";
  const isDelivered = currentCode === "DL";
  const currentLabel = currentCode ? (STATUS_MAP[currentCode] || currentCode) : "";

  return (
    <div className="min-h-[70vh] max-w-2xl mx-auto px-4 sm:px-6 py-10">

      {/* Back */}
      <button
        onClick={onGoBack}
        className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-800 bg-transparent border-none cursor-pointer mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </button>

      {/* Header */}
      <div className="mb-8 select-none">
        <span className="inline-block px-3 py-1 bg-zinc-900 text-white text-[9px] font-sans tracking-[0.2em] uppercase rounded-md mb-3">
          ORDER TRACKING
        </span>
        <h1 className="text-2xl md:text-3xl font-sans font-black tracking-tight uppercase text-zinc-900">
          Track Your Order
        </h1>
        <p className="text-xs text-zinc-400 mt-1.5">
          Enter the tracking number shared with you via WhatsApp.
        </p>
      </div>

      {/* Search Box */}
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleTrack()}
          placeholder="Enter Tracking / AWB number"
          className="flex-1 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] transition"
        />
        <button
          onClick={handleTrack}
          disabled={loading || !input.trim()}
          className="bg-[#000000] hover:bg-[#0066cc] disabled:bg-zinc-200 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-3 rounded-xl transition flex items-center gap-2 shrink-0 cursor-pointer"
        >
          {loading
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Search className="w-4 h-4" />}
          {loading ? "Tracking..." : "Track"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">Tracking Failed</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
            <button
              onClick={() => { setError(null); setInput(""); }}
              className="mt-2 flex items-center gap-1 text-xs font-bold text-red-600 bg-transparent border-none cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Try again
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {awbResult && (
        <div className="space-y-5 animate-fade-in">

          {/* Status Summary Card */}
          <div className={`rounded-2xl border p-5 ${
            isDelivered ? "bg-emerald-50 border-emerald-200" :
            isRTO       ? "bg-orange-50 border-orange-200" :
            isException ? "bg-red-50 border-red-200" :
                          "bg-gray-50 border-gray-100"
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">AWB Number</p>
                <p className="text-sm font-black text-zinc-900 mt-0.5 font-mono">{awbResult}</p>
              </div>
              <span className={`text-xs font-black uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                isDelivered ? "bg-emerald-500 text-white" :
                isRTO       ? "bg-orange-500 text-white" :
                isException ? "bg-red-500 text-white" :
                              "bg-[#000000] text-white"
              }`}>
                {isDelivered ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 isRTO || isException ? <XCircle className="w-3.5 h-3.5" /> :
                 <Truck className="w-3.5 h-3.5" />}
                {currentLabel}
              </span>
            </div>
          </div>

          {/* Step Tracker — only for normal delivery */}
          {!isRTO && (
            <div className="bg-white border border-zinc-100 rounded-2xl p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-5">Shipment Progress</h3>
              <div className="relative">
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-zinc-100" />
                <div className="space-y-5">
                  {STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const done = idx <= currentStep;
                    const active = idx === currentStep;
                    return (
                      <div key={step.code} className="flex items-center gap-4 relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                          done
                            ? active ? "bg-[#000000] shadow-md shadow-blue-200" : "bg-emerald-500"
                            : "bg-zinc-100"
                        }`}>
                          <Icon className={`w-4 h-4 ${done ? "text-white" : "text-zinc-400"}`} />
                        </div>
                        <div>
                          <p className={`text-xs font-black uppercase tracking-wide ${done ? "text-zinc-900" : "text-zinc-400"}`}>
                            {step.label}
                          </p>
                          {active && events[0]?.timestamp && (
                            <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatTs(events[0].timestamp)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Events Timeline */}
          {events.length > 0 && (
            <div className="bg-white border border-zinc-100 rounded-2xl p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-5">Tracking History</h3>
              <div className="space-y-4">
                {events.map((ev, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${i === 0 ? "bg-[#000000]" : "bg-zinc-300"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-800">
                        {STATUS_MAP[ev.status_code] || ev.status || ev.status_code}
                      </p>
                      {ev.location && (
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" /> {ev.location}
                        </p>
                      )}
                      {ev.timestamp && (
                        <p className="text-[10px] text-zinc-400 mt-0.5">{formatTs(ev.timestamp)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Track another */}
          <button
            onClick={() => { setEvents([]); setCurrentCode(null); setAwbResult(null); setInput(""); setError(null); }}
            className="w-full border border-zinc-200 text-zinc-600 text-xs font-bold uppercase tracking-widest py-3 rounded-xl hover:bg-zinc-50 transition bg-transparent cursor-pointer"
          >
            Track Another Order
          </button>
        </div>
      )}

      {/* Empty state */}
      {!awbResult && !error && !loading && (
        <div className="text-center py-16 select-none">
          <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-zinc-300" />
          </div>
          <p className="text-sm font-bold text-zinc-400">Enter your tracking number to get live updates</p>
          <p className="text-xs text-zinc-300 mt-1">Tracking number is shared via WhatsApp after your order is shipped</p>
        </div>
      )}
    </div>
  );
};
