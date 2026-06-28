import React, { useState } from "react";
import { Instagram, ArrowLeft, ExternalLink } from "lucide-react";

interface Snap {
  url: string;
  imageUrl: string;
  caption?: string;
}

interface OurSnapsPageProps {
  snaps: Snap[];
  onGoBack: () => void;
}

export const OurSnapsPage: React.FC<OurSnapsPageProps> = ({ snaps, onGoBack }) => {
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const handleImageError = (index: number) => {
    setFailedImages((prev) => new Set(prev).add(index));
  };

  const validSnaps = snaps.filter((s) => s.imageUrl && s.url);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-10 pb-6">
        <button
          onClick={onGoBack}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 text-xs font-semibold mb-8 bg-transparent border-none cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        {/* Title */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Instagram className="w-5 h-5 text-zinc-800" />
            <span className="text-[10px] font-sans tracking-[0.22em] uppercase text-zinc-500 font-bold">Instagram</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-zinc-950">Our Snaps</h1>
          <p className="text-xs text-zinc-400 mt-3 font-medium">
            Real covers. Real customers. Follow us{" "}
            <a
              href="https://www.instagram.com/fabcoverz.store/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-700 font-bold underline underline-offset-2 hover:text-zinc-950"
            >
              @fabcoverz.store
            </a>
          </p>
        </div>

        {/* Empty state */}
        {validSnaps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
              <Instagram className="w-8 h-8 text-zinc-300" />
            </div>
            <p className="text-sm font-bold text-zinc-400">No snaps yet. Check back soon.</p>
            <a
              href="https://www.instagram.com/fabcoverz.store/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-black text-zinc-800 border border-zinc-200 rounded-xl px-4 py-2.5 hover:bg-zinc-50 transition-colors"
            >
              <Instagram className="w-3.5 h-3.5" />
              Visit our Instagram
            </a>
          </div>
        )}

        {/* Gallery Grid — 2 col mobile / 4 col desktop */}
        {validSnaps.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {validSnaps.map((snap, i) => (
              <a
                key={i}
                href={snap.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block bg-zinc-100 rounded-2xl overflow-hidden aspect-square"
                title={snap.caption || "View on Instagram"}
              >
                {!failedImages.has(i) ? (
                  <img
                    src={snap.imageUrl}
                    alt={snap.caption || `FabCoverz snap ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    onError={() => handleImageError(i)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  /* Fallback if image fails */
                  <div className="w-full h-full flex items-center justify-center bg-zinc-100">
                    <Instagram className="w-8 h-8 text-zinc-300" />
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center gap-1.5 text-white text-center px-3">
                    <ExternalLink className="w-5 h-5" />
                    <span className="text-[10px] font-black tracking-wide uppercase">View on Instagram</span>
                    {snap.caption && (
                      <p className="text-[9px] font-medium leading-tight line-clamp-2 text-white/80 max-w-[120px]">
                        {snap.caption}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        {validSnaps.length > 0 && (
          <div className="mt-12 text-center">
            <a
              href="https://www.instagram.com/fabcoverz.store/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-black text-white text-xs font-black tracking-widest uppercase px-6 py-3.5 rounded-xl transition-all"
            >
              <Instagram className="w-4 h-4" />
              Follow us on Instagram
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
