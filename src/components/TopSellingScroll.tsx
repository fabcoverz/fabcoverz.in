import React, { useRef, useCallback, useEffect, useState } from "react";
import { Product } from "../types";
import { cdnThumb } from "../utils/cloudinary";

interface TopSellingScrollProps {
  products: Product[];
  title?: string;
  onSelectProduct: (product: Product) => void;
}

export const TopSellingScroll: React.FC<TopSellingScrollProps> = ({
  products,
  title = "Top Selling Products",
  onSelectProduct,
}) => {
  if (!products || products.length === 0) return null;

  const trackRef = useRef<HTMLDivElement>(null);   // the animating inner div
  const wrapRef = useRef<HTMLDivElement>(null);     // the overflow container
  const isPausedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  // Triple for seamless loop
  const tripled = [...products, ...products, ...products];

  // ─── Pause / Resume CSS animation ──────────────────────────────────
  const pause = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    isPausedRef.current = true;
    if (trackRef.current) {
      trackRef.current.style.animationPlayState = "paused";
    }
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    if (trackRef.current) {
      trackRef.current.style.animationPlayState = "running";
    }
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(resume, 2500);
  }, [resume]);

  // Re-run animation when tab becomes visible again (phone screen on)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !isPausedRef.current) {
        resume();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [resume]);

  // ─── Manual drag: move the WRAPPER's scrollLeft, not the track ─────
  // Track animates via CSS translateX; manual drag scrolls the wrapper.
  // They don't interfere because they're on different elements.

  const onMouseEnter = () => pause();
  const onMouseLeave = () => {
    isDraggingRef.current = false;
    setGrabbing(false);
    scheduleResume();
  };

  const onMouseDown = (e: React.MouseEvent) => {
    pause();
    isDraggingRef.current = false;
    startXRef.current = e.pageX;
    startScrollRef.current = wrapRef.current?.scrollLeft || 0;
    setGrabbing(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1 || !wrapRef.current) return;
    const walk = (e.pageX - startXRef.current) * 1.5;
    if (Math.abs(walk) > 4) isDraggingRef.current = true;
    wrapRef.current.scrollLeft = startScrollRef.current - walk;
  };

  const onMouseUp = () => {
    setGrabbing(false);
    scheduleResume();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    pause();
    isDraggingRef.current = false;
    startXRef.current = e.touches[0].pageX;
    startScrollRef.current = wrapRef.current?.scrollLeft || 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!wrapRef.current) return;
    const walk = (e.touches[0].pageX - startXRef.current) * 1.5;
    if (Math.abs(walk) > 6) isDraggingRef.current = true;
    wrapRef.current.scrollLeft = startScrollRef.current - walk;
  };

  const onTouchEnd = () => scheduleResume();

  const handleProductClick = (product: Product) => {
    if (!isDraggingRef.current) onSelectProduct(product);
    isDraggingRef.current = false;
  };

  return (
    <section className="py-6">
      {/* Inject keyframes once */}
      <style>{`
        @keyframes topSellingLoop {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.3333%); }
        }
        .top-selling-track {
          animation: topSellingLoop 28s linear infinite;
          will-change: transform;
          animation-play-state: running;
        }
      `}</style>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 mb-5 select-none">
        <div className="text-center pb-4 border-b border-zinc-100">
          <span className="inline-block px-3 py-1 bg-zinc-900 text-white text-[9px] font-sans tracking-[0.2em] uppercase w-fit select-none mb-3.5 rounded-md">
            Our Best Picks
          </span>
          <h2 className="text-2xl md:text-3xl font-sans tracking-tight font-black text-zinc-900 uppercase">
            {title}
          </h2>
          <p className="text-[10px] font-sans font-bold text-zinc-400 uppercase tracking-widest mt-2">
            Scroll or Drag →
          </p>
        </div>
      </div>

      {/* Scroll container */}
      <div className="relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        {/* Wrapper: captures manual scroll/drag */}
        <div
          ref={wrapRef}
          className={`overflow-x-auto scrollbar-hide select-none ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ WebkitOverflowScrolling: "touch" }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Track: CSS animation drives auto-scroll via translateX */}
          <div
            ref={trackRef}
            className="top-selling-track flex gap-3 px-6"
            style={{ width: "max-content" }}
          >
            {tripled.map((product, idx) => (
              <div
                key={`${product.id}-${idx}`}
                onClick={() => handleProductClick(product)}
                className="flex-shrink-0 w-56 sm:w-64 group"
              >
                <div className="bg-zinc-50 rounded-xl overflow-hidden aspect-[3/4] w-full relative border border-zinc-100 group-hover:border-[#000000]/40 transition-all duration-300">
                  <img
                    src={cdnThumb(product.images[0] || "/placeholder.png")}
                    alt={product.title}
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                  {product.comparePrice && product.comparePrice > product.price && (
                    <span className="absolute top-1.5 left-1.5 bg-zinc-900 text-white text-[8px] font-black font-sans px-1.5 py-0.5 rounded-full">
                      Sale
                    </span>
                  )}
                </div>
                <div className="mt-2.5 px-0.5">
                  <p className="text-[12px] font-black italic text-zinc-800 line-clamp-2 leading-snug group-hover:text-[#000000] transition-colors">
                    {product.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3">
                    {product.comparePrice && (
                      <span className="text-[11px] text-zinc-400 line-through font-sans italic">
                        ₹{product.comparePrice}
                      </span>
                    )}
                    <span className="text-sm font-black italic text-zinc-900">₹{product.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
