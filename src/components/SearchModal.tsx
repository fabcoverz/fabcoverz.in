import React, { useState, useEffect, useRef } from "react";
import { Search, X, Package, Grid3X3, ArrowRight } from "lucide-react";
import { Product, Collection } from "../types";
import { trackSearch } from "../utils/metaPixel";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  collections: Collection[];
  onSelectProduct: (product: Product) => void;
  onSelectCollection: (slug: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  products,
  collections,
  onSelectProduct,
  onSelectCollection,
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Meta Pixel: Search (debounced 800ms)
  useEffect(() => {
    if (query.trim().length < 3) return;
    const t = setTimeout(() => trackSearch(query.trim()), 800);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const q = query.trim().toLowerCase();

  const filteredProducts = q.length >= 1
    ? products.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.description?.toLowerCase().includes(q) ||
          p.collectionId?.toLowerCase().includes(q)
      )
    : [];

  const filteredCollections = q.length >= 1
    ? collections.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.slug?.toLowerCase().includes(q)
      )
    : [];

  const hasResults = filteredProducts.length > 0 || filteredCollections.length > 0;
  const noResults = q.length >= 1 && !hasResults;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: "80px" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden animate-slide-up">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, collections, styles…"
            className="flex-1 bg-transparent text-zinc-900 text-sm placeholder-zinc-400 outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-zinc-400 hover:text-zinc-700 bg-transparent border-none cursor-pointer p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-1 text-zinc-400 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border-none cursor-pointer p-1.5 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Empty state / hint */}
          {q.length === 0 && (
            <div className="px-5 py-10 text-center text-zinc-400">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Start typing to search products and collections</p>
            </div>
          )}

          {/* No results */}
          {noResults && (
            <div className="px-5 py-10 text-center text-zinc-400">
              <p className="text-sm font-medium">No results for "<span className="text-zinc-700">{query}</span>"</p>
              <p className="text-xs mt-1">Try a different keyword or browse collections</p>
            </div>
          )}

          {/* Collections */}
          {filteredCollections.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <p className="text-[10px] uppercase font-sans font-bold text-zinc-400 tracking-widest mb-2 flex items-center gap-1.5">
                <Grid3X3 className="w-3 h-3" /> Collections
              </p>
              <div className="space-y-1">
                {filteredCollections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => {
                      onSelectCollection(col.slug);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors group bg-transparent border-none cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {col.image && (col.image.startsWith("data:") || col.image.startsWith("http")) ? (
                        <img src={col.image} alt={col.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <Grid3X3 className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-900 uppercase tracking-wide truncate">{col.name}</p>
                      {col.description && (
                        <p className="text-[11px] text-zinc-400 truncate">{col.description}</p>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-[#000000] transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {filteredProducts.length > 0 && (
            <div className="px-5 pt-4 pb-5">
              <p className="text-[10px] uppercase font-sans font-bold text-zinc-400 tracking-widest mb-2 flex items-center gap-1.5">
                <Package className="w-3 h-3" /> Products
              </p>
              <div className="space-y-1">
                {filteredProducts.slice(0, 8).map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => {
                      onSelectProduct(prod);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors group bg-transparent border-none cursor-pointer text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {prod.images && prod.images[0] ? (
                        <img src={prod.images[0]} alt={prod.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-900 truncate">{prod.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-black text-[#000000]">₹{prod.price}</span>
                        {prod.comparePrice > prod.price && (
                          <span className="text-[10px] text-zinc-400 line-through">₹{prod.comparePrice}</span>
                        )}
                        {prod.stockStatus === "out_of_stock" && (
                          <span className="text-[10px] text-red-500 font-semibold">Out of stock</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-[#000000] transition-colors shrink-0" />
                  </button>
                ))}
                {filteredProducts.length > 8 && (
                  <p className="text-[11px] text-zinc-400 text-center pt-1">
                    +{filteredProducts.length - 8} more results
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
