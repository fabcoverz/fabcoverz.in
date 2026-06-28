import React, { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { StoreSettings } from "../types";

interface NewsletterProps {
  settings?: StoreSettings | null;
}

export const Newsletter: React.FC<NewsletterProps> = ({ settings }) => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 5000);
  };

  return (
    <section className="py-20 bg-zinc-950 text-white relative overflow-hidden" id="newsletter">
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <span className="inline-block px-3 py-1 bg-zinc-900 border border-zinc-800 text-white text-[9px] font-sans tracking-[0.2em] uppercase select-none mb-3 rounded-md">
          {settings?.newsletterBadge || "UNLOCK EXCLUSIVE DROPS"}
        </span>
        <h2 className="text-3xl md:text-4xl font-sans tracking-tight font-black uppercase mt-4">
          {settings?.newsletterTitle || "Subscribe & Save 10% On Your First Cover"}
        </h2>
        <p className="text-xs text-zinc-400 mt-3 max-w-xl mx-auto leading-relaxed">
          {settings?.newsletterSubtitle || "Join 45,000+ custom cover collectors! Get exclusive notifications about pre-order events, TVK VIP discounts, and spiritual collection drops."}
        </p>

        <div className="mt-10 max-w-md mx-auto">
          {subscribed ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-center gap-3 text-zinc-100 font-sans text-xs animate-fade-in font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#000000]" />
              <span>Checked! Check your inbox for your 10% coupon code.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="YOUR EMAIL CORRESPONDENCE"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-500 rounded-xl px-5 py-3.5 text-xs font-sans text-white tracking-widest placeholder-zinc-600 transition-all outline-none"
                required
              />
              <button
                type="submit"
                className="bg-white hover:bg-zinc-100 font-sans text-zinc-950 text-xs tracking-widest uppercase font-bold px-6 py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none shrink-0"
              >
                <span>Notify Me</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
        <p className="text-[9px] text-zinc-500 font-sans tracking-wider uppercase mt-4">
          {settings?.newsletterDisclaimer || "Unsubscribe instantly at any time. No spam, we guarantee 100% genuine design drops."}
        </p>
      </div>
    </section>
  );
};
