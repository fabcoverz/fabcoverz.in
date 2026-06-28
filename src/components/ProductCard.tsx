import React, { useState, useCallback } from "react";
import { cdnThumb, cdnLqip, cdnSrcSet, cdnImg } from "../utils/cloudinary";
import { Eye } from "lucide-react";
import { Product } from "../types";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

// Preload the full product detail image on hover so ProductPage loads instantly
function preloadProductDetailImage(url: string) {
  if (!url || !url.includes("res.cloudinary.com")) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url.replace("/upload/", "/upload/f_auto,q_auto:good,w_800,c_limit/");
  document.head.appendChild(link);
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const [loaded, setLoaded] = useState(false);
  const [preloaded, setPreloaded] = useState(false);
  const hasDiscount = product.comparePrice && product.comparePrice > product.price;
  const imgSrc = cdnThumb(product.images[0] || "/placeholder.png");
  const lqip    = cdnLqip(product.images[0] || "");
  const srcSet  = cdnSrcSet(product.images[0] || "");
  const isCloudinary = (product.images[0] || "").includes("res.cloudinary.com");

  const handleMouseEnter = useCallback(() => {
    if (!preloaded && product.images[0]) {
      preloadProductDetailImage(product.images[0]);
      setPreloaded(true);
    }
  }, [preloaded, product.images]);

  return (
    <div
      onClick={() => onSelect(product)}
      onMouseEnter={handleMouseEnter}
      className="group bg-white border border-zinc-100 hover:border-zinc-200 hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden cursor-pointer flex flex-col"
      id={`product-card-${product.id}`}
    >
      {/* Image Container */}
      <div className="relative bg-zinc-50 flex items-center justify-center aspect-[3/4] overflow-hidden shrink-0">

        {/* SALE badge */}
        {hasDiscount && (
          <span className="absolute top-2 left-2 z-20 bg-zinc-900 text-white text-[10px] font-black font-sans uppercase tracking-wider px-2.5 py-1 rounded-full select-none">
            Sale
          </span>
        )}

        {/* Non-sale badges */}
        {!hasDiscount && product.isBestSeller && (
          <span className="absolute top-2 left-2 z-20 bg-[#000000] text-white text-[9px] font-black font-sans uppercase tracking-wider px-2.5 py-1 rounded-full select-none italic">
            Best Seller
          </span>
        )}
        {!hasDiscount && product.isTrending && (
          <span className="absolute top-2 left-2 z-20 bg-red-500 text-white text-[9px] font-black font-sans uppercase tracking-wider px-2.5 py-1 rounded-full select-none italic">
            Viral Drop
          </span>
        )}
        {!hasDiscount && product.isNewArrival && !product.isBestSeller && !product.isTrending && (
          <span className="absolute top-2 left-2 z-20 bg-zinc-900 text-white text-[9px] font-black font-sans uppercase tracking-wider px-2.5 py-1 rounded-full select-none">
            New Arrival
          </span>
        )}

        {/* Blur-up placeholder — shows instantly while real image loads */}
        {isCloudinary && !loaded && lqip && (
          <img
            src={lqip}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-contain blur-sm scale-105 pointer-events-none select-none"
          />
        )}

        {/* Skeleton shimmer — shown before any image ready */}
        {!loaded && (
          <div className="absolute inset-0 bg-zinc-100 animate-pulse" />
        )}

        {/* Product Image */}
        <img
          src={imgSrc}
          srcSet={srcSet || undefined}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          alt={product.title}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-contain pointer-events-none select-none transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
          referrerPolicy="no-referrer"
        />

        {/* Ribbon */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10 mx-2 mb-2 rounded-xl overflow-hidden">
          <div className="bg-zinc-950/85 w-full h-8 flex items-center overflow-hidden rounded-xl">
            <div
              className="whitespace-nowrap text-white font-bold italic text-[9px] tracking-widest uppercase select-none"
              style={{ animation: "ribbonScroll 6s linear infinite" }}
            >
              &nbsp;&nbsp;Choose Your Model Inside &nbsp;&nbsp;|&nbsp;&nbsp; Choose Your Model Inside &nbsp;&nbsp;|&nbsp;&nbsp; Choose Your Model Inside &nbsp;&nbsp;|&nbsp;&nbsp;
            </div>
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-zinc-950/20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-20">
          <div className="bg-white text-zinc-900 text-[10px] font-bold tracking-widest uppercase py-2 px-4 rounded-xl flex items-center gap-2 transform translate-y-3 group-hover:translate-y-0 transition-all duration-300 shadow-sm">
            <Eye className="w-3.5 h-3.5 text-[#000000]" />
            <span>View Details</span>
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="p-3 flex flex-col gap-1">
        <h3 className="font-sans font-black italic text-zinc-900 text-[13px] leading-snug line-clamp-2 group-hover:text-[#000000] transition-colors text-center">
          {product.title}
        </h3>

        <div className="flex items-center justify-center gap-2 pt-1">
          {product.comparePrice && (
            <span className="text-xs font-sans text-zinc-400 line-through italic">
              ₹{product.comparePrice}
            </span>
          )}
          <span className="text-xl font-black italic text-zinc-900 tracking-tight">
            ₹{product.price}
          </span>
        </div>
      </div>
    </div>
  );
};
