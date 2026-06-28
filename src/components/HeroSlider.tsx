import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Banner } from "../types";

interface HeroSliderProps {
  banners: Banner[];
  onNavigate: (slug: string) => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ banners, onNavigate }) => {
  const [index, setIndex] = useState(0);

  const activeBanners = banners && banners.filter(b => b.active !== false);
  const hasDBBanners = activeBanners.length > 0;

  useEffect(() => {
    setIndex(0);
  }, [banners]);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % activeBanners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  return (
    <div className="relative overflow-hidden bg-zinc-950 select-none">

      {!hasDBBanners ? (
        /* No DB banners — show local fallback */
        <picture>
          <source media="(min-width: 768px)" srcSet="/assets/banner/desktop_banner.png" />
          <img
            src="/assets/banner/mobile_banner.png"
            alt="FabCoverz Banner"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="w-full h-auto block object-cover"
            draggable={false}
          />
        </picture>
      ) : (
        <>
          {/* DB banners — fully replace local banner */}
          {activeBanners.map((b, idx) => (
            <div
              key={b.id}
              className={`transition-opacity duration-700 ${idx === index ? "opacity-100" : "opacity-0 absolute inset-0"}`}
            >
              {b.imageUrl ? (
                <picture>
                  {b.mobileImageUrl && (
                    <source media="(max-width: 767px)" srcSet={b.mobileImageUrl} />
                  )}
                  <img
                    src={b.imageUrl}
                    alt={b.title || "Banner"}
                    loading={idx === 0 ? "eager" : "lazy"}
                    className="w-full h-auto block object-cover"
                    draggable={false}
                  />
                </picture>
              ) : (
                /* Banner has no image — show local fallback image with text overlay */
                <div className="relative">
                  <picture>
                    <source media="(min-width: 768px)" srcSet="/assets/banner/desktop_banner.png" />
                    <img
                      src="/assets/banner/mobile_banner.png"
                      alt="FabCoverz Banner"
                      loading="eager"
                      className="w-full h-auto block object-cover"
                      draggable={false}
                    />
                  </picture>
                  {(b.title || b.subtitle) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4 bg-black/30">
                      {b.badge && <span className="text-xs font-bold tracking-widest uppercase mb-2 opacity-80">{b.badge}</span>}
                      {b.title && <h2 className="text-2xl md:text-4xl font-bold mb-2">{b.title}</h2>}
                      {b.subtitle && <p className="text-sm md:text-base opacity-80">{b.subtitle}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Slide nav arrows — only shown when multiple banners */}
      {activeBanners.length > 1 && (
        <>
          <button
            onClick={() => setIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-zinc-900/40 border border-zinc-800 hover:bg-zinc-900 text-white transition-all cursor-pointer outline-none z-30 rounded-xl"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIndex((prev) => (prev + 1) % activeBanners.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-zinc-900/40 border border-zinc-800 hover:bg-zinc-900 text-white transition-all cursor-pointer outline-none z-30 rounded-xl"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
            {activeBanners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setIndex(idx)}
                className={`h-1 rounded-full cursor-pointer border-none outline-none transition-all duration-300 ${
                  idx === index ? "bg-[#000000] w-8" : "bg-white/30 hover:bg-white/50 w-4"
                }`}
              ></button>
            ))}
          </div>
        </>
      )}

    </div>
  );
};
