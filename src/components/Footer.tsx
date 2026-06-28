import React, { useState } from "react";
import { Instagram, Facebook, Twitter, Youtube } from "lucide-react";
import { StoreSettings, Collection } from "../types";

interface FooterProps {
  onNavigate: (page: string) => void;
  settings?: StoreSettings | null;
  collections?: Collection[];
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, settings, collections = [] }) => {
  const [clickCount, setClickCount] = useState(0);

  const handleSecretClick = () => {
    setClickCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        onNavigate("admin");
        return 0;
      }
      return next;
    });
  };

  return (
    <footer className="bg-white border-t border-zinc-200 text-zinc-900 py-16 font-sans">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 pb-12 border-b border-zinc-200">
          
          {/* Brand block */}
          <div className="space-y-4">
            <button 
              onClick={() => onNavigate("home")}
              className="bg-transparent border-none p-0 cursor-pointer text-left select-none"
            >
              <span className="text-xl font-black uppercase tracking-tight text-zinc-900">FabCoverz</span>
            </button>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
              {settings?.footerDisclaimer || "India's leading e-commerce hub for premium Metal Glossy Cases and premium lettering cover sleeves. Crafting distinct visual shield systems since 2026."}
            </p>
            <div className="flex items-center gap-2 pt-2 text-[10px] font-sans uppercase font-bold text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Verified Brand Quality</span>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <a 
                href={settings?.instagramUrl || "https://instagram.com/fabcoverz.store"} 
                target="_blank" rel="noreferrer" 
                className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:text-[#000000] hover:border-[#000000] transition-all bg-zinc-50 hover:bg-white"
                title="Follow on Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a 
                href={settings?.facebookUrl || "https://www.facebook.com/profile.php?id=61590280420176"} 
                target="_blank" rel="noreferrer" 
                className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:text-[#000000] hover:border-[#000000] transition-all bg-zinc-50 hover:bg-white"
                title="Follow on Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              {settings?.twitterUrl && (
                <a 
                  href={settings.twitterUrl} 
                  target="_blank" rel="noreferrer" 
                  className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:text-[#000000] hover:border-[#000000] transition-all bg-zinc-50 hover:bg-white"
                  title="Follow on X / Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
              )}
              {settings?.youtubeUrl && (
                <a 
                  href={settings.youtubeUrl} 
                  target="_blank" rel="noreferrer" 
                  className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:text-red-500 hover:border-red-400 transition-all bg-zinc-50 hover:bg-white"
                  title="Subscribe on YouTube"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="text-[10px] font-sans text-zinc-400 uppercase tracking-wide leading-relaxed pt-2">
              {settings?.contactAddress || "Chennai, Tamil Nadu, India"}
            </div>
          </div>

          {/* Dynamic Collections */}
          <div>
            <h4 className="text-[10px] font-sans tracking-widest text-[#000000] uppercase font-black mb-4">
              Available Collections
            </h4>
            {collections.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">No collections yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs font-semibold text-zinc-600">
                {collections.map((col) => (
                  <li key={col.id}>
                    <button
                      onClick={() => onNavigate(`collection-${col.slug}`)}
                      className="hover:text-[#000000] bg-transparent border-none p-0 cursor-pointer transition-colors text-left font-sans uppercase text-[11px] tracking-wide"
                    >
                      {col.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        {/* Legal */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          <div 
            onClick={handleSecretClick} 
            className="cursor-pointer hover:text-zinc-500 select-none transition-colors"
            title="Designed with durability"
          >
            © {new Date().getFullYear()} FabCoverz. Designed for premium durability.
          </div>
          <div className="flex gap-6">
            <button onClick={() => onNavigate("policy-privacy")} className="bg-transparent border-none p-0 cursor-pointer hover:text-zinc-600 transition-colors">Privacy Policy</button>
            <button onClick={() => onNavigate("policy-shipping")} className="bg-transparent border-none p-0 cursor-pointer hover:text-zinc-600 transition-colors">Shipping Policy</button>
            <button onClick={() => onNavigate("policy-terms")} className="bg-transparent border-none p-0 cursor-pointer hover:text-zinc-600 transition-colors">Terms of Service</button>
            <button onClick={() => onNavigate("policy-refund")} className="bg-transparent border-none p-0 cursor-pointer hover:text-zinc-600 transition-colors">Refund Policy</button>
            <button onClick={() => onNavigate("track_order")} className="bg-transparent border-none p-0 cursor-pointer hover:text-[#000000] transition-colors">Track Order</button>
          </div>
        </div>

      </div>
    </footer>
  );
};
