import React from "react";
import { Collection, Product } from "../types";
import { PhoneMockup } from "./PhoneMockup";
import { ChevronRight, Smartphone } from "lucide-react";
import { TopSellingScroll } from "./TopSellingScroll";
import { cdnCollectionImg } from "../utils/cloudinary";

interface CollectionsPageProps {
  collections: Collection[];
  products: Product[];
  onSelectCollection: (slug: string) => void;
  onSelectProduct: (product: Product) => void;
  collectionOrder?: string[];
  topSellingTitle?: string;
  topSellingProductIds?: string[];
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  collections,
  products,
  onSelectCollection,
  onSelectProduct,
  collectionOrder,
  topSellingTitle,
  topSellingProductIds,
}) => {
  const topProducts = (topSellingProductIds && topSellingProductIds.length > 0)
    ? topSellingProductIds.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[]
    : products.filter(p => p.isBestSeller || p.isTrending).slice(0, 10);

  const DEFAULT_ORDER = ["photo-cases", "god-cases", "tvk-cases", "trendy-cases", "girly-cases"];
  const visibleCollections = collections.filter(c => c.isVisible !== false);

  const sortedCollections = collectionOrder && collectionOrder.length > 0
    ? [...visibleCollections].sort((a, b) => {
        const oa = collectionOrder.indexOf(a.slug);
        const ob = collectionOrder.indexOf(b.slug);
        return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
      })
    : [...visibleCollections].sort((a, b) => {
        const oa = DEFAULT_ORDER.indexOf(a.slug);
        const ob = DEFAULT_ORDER.indexOf(b.slug);
        return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
      });

  return (
    <div className="py-12 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        {/* Banner Section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-sans tracking-tight font-black text-zinc-900 mt-4 uppercase">
            Phone Case Collections – Buy Online India
          </h1>
        </div>

        {/* Collections Grid — show all */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {sortedCollections.map((coll) => (
            <div
              key={coll.id}
              onClick={() => onSelectCollection(coll.slug)}
              className="group bg-white border border-zinc-200/80 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md cursor-pointer text-center relative"
              id={`collection-entry-${coll.id}`}
            >
              {/* 1:1 ratio image — full width, no padding */}
              <div className="bg-zinc-50 w-full relative overflow-hidden select-none" style={{aspectRatio: "1/1"}}>
                {coll.image && (coll.image.startsWith("data:") || coll.image.startsWith("http://") || coll.image.startsWith("https://")) ? (
                  <img 
                    src={cdnCollectionImg(coll.image)} 
                    alt={coll.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain transform transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center transform transition-transform duration-500 group-hover:scale-105">
                    <PhoneMockup designId={coll.image} size="sm" />
                  </div>
                )}
              </div>

              {/* Bold italic name */}
              <h3 className="font-sans font-black italic text-base sm:text-lg text-zinc-900 group-hover:text-[#000000] transition-colors flex items-center justify-center gap-1 px-4 py-4 uppercase tracking-wide select-none">
                <span>{coll.name}</span>
                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#000000] transition-transform group-hover:translate-x-0.5 shrink-0" />
              </h3>
            </div>
          ))}
        </div>

        {/* Top Selling Scroll — below collections grid */}
        {topProducts.length > 0 && (
          <div className="mt-12">
            <TopSellingScroll
              products={topProducts}
              title={topSellingTitle || "Top Selling Products"}
              onSelectProduct={onSelectProduct}
            />
          </div>
        )}
      </div>
    </div>
  );
};
