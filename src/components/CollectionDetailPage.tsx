import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, ChevronRight, ChevronLeft, ChevronLeft as ChevLeft, ChevronRight as ChevRight } from "lucide-react";
import { Product, Collection } from "../types";
import { ProductCard } from "./ProductCard";

interface CollectionDetailPageProps {
  collection: Collection;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onGoBack: () => void;
  productOrder?: string[];
  subcollectionProductOrder?: Record<string, string[]>;
  initialSubCollectionId?: string | null;
  onSubCollectionChange?: (subId: string | null) => void;
  allCollections?: Collection[];
}

type SortOption = "featured" | "price-asc" | "price-desc" | "newest" | "custom";

const PRODUCTS_PER_PAGE = 32;

// ── Main Component ────────────────────────────────────────────────────────────
export const CollectionDetailPage: React.FC<CollectionDetailPageProps> = ({
  collection,
  products,
  onSelectProduct,
  onGoBack,
  productOrder = [],
  subcollectionProductOrder = {},
  initialSubCollectionId,
  onSubCollectionChange,
  allCollections = [],
}) => {
  const [searchQuery, setSearchQuery]     = useState("");
  const [currentPage, setCurrentPage]     = useState(1);
  const _initSubId = initialSubCollectionId || "all";
  const _initSort: SortOption = _initSubId === "all"
    ? (productOrder.length > 0 ? "custom" : "newest")
    : (subcollectionProductOrder[_initSubId]?.length > 0 ? "custom" : "newest");
  const [sortBy, setSortBy]               = useState<SortOption>(_initSort);
  const [activeSubId, setActiveSubId]     = useState<string>(_initSubId);
  const hasSubcollections = (collection.subcollections?.length ?? 0) > 0;
  const subcollScrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveSubId(initialSubCollectionId || "all");
  }, [initialSubCollectionId]);

  const handleSubCollectionChange = (subId: string) => {
    setActiveSubId(subId);
    setSearchQuery("");
    setCurrentPage(1);
    if (subId === "all") {
      setSortBy(productOrder.length > 0 ? "custom" : "newest");
    } else {
      setSortBy(subcollectionProductOrder[subId]?.length > 0 ? "custom" : "newest");
    }
    onSubCollectionChange?.(subId === "all" ? null : subId);
  };

  const subcollectionProducts = useMemo(() => {
    if (!hasSubcollections || activeSubId === "all") return products;
    const sub = collection.subcollections!.find(s => s.id === activeSubId);
    if (!sub) return products;
    return products.filter(p => sub.productIds.includes(p.id));
  }, [products, activeSubId, collection.subcollections, hasSubcollections]);

  const filteredAndSortedProducts = useMemo(() => {
    let list = [...subcollectionProducts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    const activeSubOrder = activeSubId !== "all" && subcollectionProductOrder[activeSubId]
      ? subcollectionProductOrder[activeSubId]
      : productOrder;

    switch (sortBy) {
      case "custom":
        if (activeSubOrder.length > 0) {
          list.sort((a, b) => {
            const ia = activeSubOrder.indexOf(a.id);
            const ib = activeSubOrder.indexOf(b.id);
            return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
          });
        }
        break;
      case "price-asc":  list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "newest":     list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      default:           list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)); break;
    }
    return list;
  }, [subcollectionProducts, searchQuery, sortBy, productOrder, subcollectionProductOrder, activeSubId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, activeSubId]);

  // ── SEO: BreadcrumbList JSON-LD — Google shows "FabCoverz > Metal Cases" in results ──
  useEffect(() => {
    const BASE = "https://www.fabcoverz.store";
    const activeSub = hasSubcollections && activeSubId !== "all"
      ? collection.subcollections!.find(s => s.id === activeSubId)
      : null;

    const breadcrumbItems: Array<Record<string, unknown>> = [
      { "@type": "ListItem", "position": 1, "name": "FabCoverz", "item": BASE },
      { "@type": "ListItem", "position": 2, "name": "Collections", "item": `${BASE}/collections` },
      { "@type": "ListItem", "position": 3, "name": collection.name, "item": `${BASE}/collections/${collection.slug}` },
    ];

    if (activeSub) {
      breadcrumbItems.push({
        "@type": "ListItem",
        "position": 4,
        "name": activeSub.name,
        "item": `${BASE}/collections/${collection.slug}/${activeSub.id}`,
      });
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbItems,
    };

    const old = document.getElementById("breadcrumb-json-ld");
    if (old) old.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id   = "breadcrumb-json-ld";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const el = document.getElementById("breadcrumb-json-ld");
      if (el) el.remove();
    };
  }, [collection.slug, collection.name, activeSubId]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredAndSortedProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollSubcoll = (dir: "left" | "right") => {
    if (!subcollScrollRef.current) return;
    subcollScrollRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <div className="py-12 bg-white min-h-screen" ref={topRef}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">

        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-bold text-zinc-500 select-none">
          <button onClick={onGoBack} className="hover:text-zinc-900 transition cursor-pointer">Collections</button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-zinc-900">{collection.name}</span>
          {hasSubcollections && activeSubId !== "all" && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#000000]">
                {collection.subcollections!.find(s => s.id === activeSubId)?.name}
              </span>
            </>
          )}
        </div>

        {/* Collection Heading */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-sans tracking-tight font-black leading-none uppercase text-zinc-900">
            {hasSubcollections && activeSubId !== "all"
              ? `${collection.subcollections!.find(s => s.id === activeSubId)?.name || collection.name} – ${collection.name}`
              : `${collection.name} – Buy Online India`}
          </h1>
          {collection.description && (
            <p className="text-sm text-zinc-500 mt-1">{collection.description}</p>
          )}
        </div>

        {/* ── Subcollection Horizontal Scroll Strip ── */}
        {hasSubcollections && (
          <div className="mb-8 relative">
            {/* Left Arrow */}
            <button
              onClick={() => scrollSubcoll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white border border-zinc-200 rounded-full w-7 h-7 flex items-center justify-center shadow-sm hover:bg-zinc-50 transition -ml-3"
              aria-label="Scroll left"
            >
              <ChevLeft className="w-4 h-4 text-zinc-500" />
            </button>

            {/* Scrollable container — mobile: gap-2, PC: gap-4 with more px */}
            <div
              ref={subcollScrollRef}
              className="flex gap-2 md:gap-4 overflow-x-auto scrollbar-hide px-4 md:px-6 scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* Show All pill */}
              <button
                onClick={() => handleSubCollectionChange("all")}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 transition-all duration-200 min-w-[72px] ${
                  activeSubId === "all"
                    ? "bg-zinc-900 border-zinc-900 text-white shadow"
                    : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-400"
                }`}
              >
                <span className={`text-[11px] font-black uppercase tracking-tight leading-none ${activeSubId === "all" ? "text-white" : "text-zinc-700"}`}>
                  All
                </span>
                <span className={`text-[9px] font-bold ${activeSubId === "all" ? "text-white/70" : "text-zinc-400"}`}>
                  {products.length} items
                </span>
              </button>

              {collection.subcollections!.map(sub => {
                const count = products.filter(p => sub.productIds.includes(p.id)).length;
                const isActive = activeSubId === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => handleSubCollectionChange(sub.id)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 transition-all duration-200 min-w-[72px] max-w-[100px] ${
                      isActive
                        ? "bg-[#000000] border-[#000000] text-white shadow"
                        : "bg-white border-zinc-200 text-zinc-700 hover:border-[#000000]/50 hover:text-[#000000]"
                    }`}
                  >
                    {sub.image && (
                      <img
                        src={sub.image}
                        alt={sub.name}
                        className="w-8 h-8 object-cover rounded-lg"
                      />
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-tight leading-tight text-center line-clamp-2 ${isActive ? "text-white" : "text-zinc-700"}`}>
                      {sub.name}
                    </span>
                    <span className={`text-[9px] font-bold ${isActive ? "text-white/70" : "text-zinc-400"}`}>
                      {count} items
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => scrollSubcoll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white border border-zinc-200 rounded-full w-7 h-7 flex items-center justify-center shadow-sm hover:bg-zinc-50 transition -mr-3"
              aria-label="Scroll right"
            >
              <ChevRight className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        )}

        {/* Sort Bar (Filter completely removed) */}
        <div className="flex items-center justify-between gap-3 mb-8 border-b border-zinc-100 pb-4">
          <span className="text-xs font-sans font-bold text-zinc-400">
            {filteredAndSortedProducts.length} products
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black font-sans text-zinc-500 uppercase tracking-widest">Sort:</span>
            <div className="relative">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
                className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-700 outline-none cursor-pointer appearance-none pr-7">
                <option value="newest">New Arrivals</option>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
                {(() => {
                  const hasOrder = activeSubId === "all"
                    ? productOrder.length > 0
                    : subcollectionProductOrder[activeSubId]?.length > 0;
                  return hasOrder ? <option value="custom">Custom Order</option> : null;
                })()}
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none text-[10px]">▾</span>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {paginatedProducts.length === 0 ? (
          <div className="text-center py-20 bg-zinc-50 border border-zinc-200 rounded-xl p-8 max-w-lg mx-auto">
            <Search className="w-10 h-10 text-zinc-350 mx-auto" />
            <p className="font-sans text-sm font-bold text-zinc-900 mt-4">No products found.</p>
            <button onClick={() => { setSearchQuery(""); setSortBy("newest"); }}
              className="mt-6 bg-zinc-900 hover:bg-[#000000] text-xs text-white uppercase tracking-widest font-bold py-2.5 px-5 rounded-lg cursor-pointer transition-colors">
              Reset
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 px-1">
              {paginatedProducts.map(prod => (
                <ProductCard key={prod.id} product={prod} onSelect={onSelectProduct} />
              ))}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-zinc-200 text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const show = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                  const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                  const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;
                  if (showEllipsisBefore || showEllipsisAfter) {
                    return <span key={page} className="text-zinc-400 text-sm px-1">…</span>;
                  }
                  if (!show) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-9 h-9 rounded-lg text-xs font-black transition-all ${
                        page === currentPage
                          ? "bg-zinc-900 text-white shadow"
                          : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-zinc-200 text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {totalPages > 1 && (
              <p className="text-center text-[11px] font-bold text-zinc-400 mt-3 uppercase tracking-widest">
                Page {currentPage} of {totalPages} · {filteredAndSortedProducts.length} products
              </p>
            )}
          </>
        )}

        {/* ── SEO Content Block — keyword-rich, visually subtle ── */}
        <CollectionSEOContent slug={collection.slug} name={collection.name} />
      </div>
    </div>
  );
};

// ── Per-collection SEO copy ───────────────────────────────────
const COLLECTION_COPY: Record<string, { heading: string; body: string; faqs: { q: string; a: string }[] }> = {
  "god-cases": {
    heading: "Buy Murugan & God Phone Cases Online India – FabCoverz",
    body: "FabCoverz offers the widest range of devotional god phone cases in India. Our Murugan cases feature high-definition divine artwork printed on premium metal glossy panels. Shop Ganesha cases, Shiva cases, Hanuman cases, Durga cases, Krishna cases and more — all available with fast delivery across Tamil Nadu and India. Each case uses scratch-resistant hardback with soft TPU bumper for full protection.",
    faqs: [
      { q: "Murugan phone case எங்க கிடைக்கும்?", a: "FabCoverz-ல Murugan phone cases கிடைக்கும். Premium metal glossy finish-ல high-definition Murugan artwork print பண்ணி fast delivery across India." },
      { q: "Which god cases are available at FabCoverz?", a: "FabCoverz has Murugan, Ganesha, Shiva, Hanuman, Durga, Krishna, Ayyappa, Jesus and more devotional phone cases." },
      { q: "Are god phone cases good quality?", a: "Yes — FabCoverz god cases use premium metal glossy panels with scratch-resistant coating. The print won't fade and the case offers 10ft drop protection." },
    ],
  },
  "tvk-cases": {
    heading: "Buy TVK Vijay Phone Cases Online India – FabCoverz",
    body: "Show your TVK support with FabCoverz TVK phone cases. We stock the latest TVK Vijay party themed glossy mobile covers for iPhone, Samsung, OnePlus and more. Premium quality prints, vibrant colors, fast delivery across Tamil Nadu. Each TVK case is crafted on a metal glossy hardback with soft TPU edges for everyday protection.",
    faqs: [
      { q: "TVK phone case எங்க கிடைக்கும்?", a: "FabCoverz-ல TVK Vijay phone cases கிடைக்கும். Tamil Nadu across fast delivery பண்றோம்." },
      { q: "Is there a TVK phone case for iPhone?", a: "Yes — FabCoverz TVK cases are available for iPhone 13, 14, 15, 16 series and Samsung Galaxy models." },
      { q: "What is the price of TVK phone cases?", a: "FabCoverz TVK cases start from ₹199 with free shipping above ₹499." },
    ],
  },
  "metal-cases": {
    heading: "Buy Metal Glossy Phone Cases Online India – FabCoverz",
    body: "FabCoverz metal glossy phone cases combine premium protection with stunning visual appeal. Our cases feature a toughened scratch-resistant glossy back panel with soft TPU bumper sides — giving you 10ft drop protection without compromising style. Available for iPhone 13 to iPhone 16 Pro Max, Samsung Galaxy S series, OnePlus and more. Free shipping above ₹499.",
    faqs: [
      { q: "What is a metal glossy phone case?", a: "A metal glossy case has a hard scratch-resistant back with a shiny metallic finish and soft TPU sides for shock absorption — best of both worlds." },
      { q: "Metal phone case India-ல எங்க கிடைக்கும்?", a: "FabCoverz-ல premium metal glossy cases கிடைக்கும். Fast delivery across India with free shipping above ₹499." },
    ],
  },
  "photo-cases": {
    heading: "Custom Photo Phone Cases Online India – FabCoverz",
    body: "Turn your favourite memory into a stunning phone case at FabCoverz. Upload your photo and we'll print it on a premium metal glossy case with vibrant, fade-resistant colors. Perfect gift for birthdays, anniversaries, and special occasions. Compatible with iPhone, Samsung, OnePlus and 15+ brands. Fast delivery across India.",
    faqs: [
      { q: "Photo case எப்படி order பண்றது?", a: "FabCoverz-ல photo case select பண்ணி, உங்க photo upload பண்ணுங்க. Checkout-ல WhatsApp number குடுங்க — நாங்க confirm பண்ணி print பண்றோம்." },
      { q: "How long does a custom photo case take?", a: "Photo cases are processed within 24 hours and delivered in 3–5 business days across India." },
    ],
  },
  "name-cases": {
    heading: "Custom Name Phone Cases Online India – FabCoverz",
    body: "Personalize your phone with a custom name case from FabCoverz. Enter your name or initials on our product page and see a live preview before you order. Printed in elegant cursive on a premium metal glossy case. Great gift idea for birthdays. Compatible with iPhone, Samsung, OnePlus. Free shipping above ₹499.",
    faqs: [
      { q: "Name case customization எப்படி பண்றது?", a: "Product page-ல 'Enter Name' field-ல உங்க name type பண்ணுங்க — live preview-ல உடனே பாக்கலாம். Order confirm ஆனா நாங்க exact-ஆ print பண்றோம்." },
      { q: "Can I put any name on a phone case?", a: "Yes — FabCoverz name cases support any name or initials in elegant cursive lettering." },
    ],
  },
  "photo-name-cases": {
    heading: "Custom Photo & Name Phone Cases – FabCoverz India",
    body: "The ultimate personalized phone case — your photo AND your name together on one premium case. FabCoverz photo + name cases are the perfect gift for any occasion. High-quality print, metal glossy finish, fast delivery across India. Compatible with iPhone, Samsung and 15+ phone brands.",
    faqs: [
      { q: "Photo and name together on a case — is it possible?", a: "Yes! FabCoverz photo + name cases let you combine your favourite photo with a custom name in one premium case." },
    ],
  },
  "trendy-cases": {
    heading: "Trending & Designer Phone Cases Online India – FabCoverz",
    body: "Stay ahead with FabCoverz trending phone cases. Our trendy collection features the hottest viral designs, aesthetic graphics, and bold patterns — all printed on premium metal glossy cases. New designs added regularly. Compatible with iPhone, Samsung, OnePlus. Fast delivery across India.",
    faqs: [
      { q: "Latest trending phone cases India-ல எங்க கிடைக்கும்?", a: "FabCoverz-ல latest trending designs regular-ஆ add ஆகுது. Premium glossy finish with fast delivery." },
    ],
  },
  "girly-cases": {
    heading: "Cute Girly Phone Cases for Girls – FabCoverz India",
    body: "FabCoverz girly cases are designed for those who love cute, aesthetic, and feminine phone covers. Shop pink cases, floral designs, love-themed covers and more — all in premium metal glossy finish. Great gift for girls. Available for iPhone, Samsung. Free shipping above ₹499.",
    faqs: [
      { q: "Cute phone cases for girls — best brand in India?", a: "FabCoverz has the widest range of cute girly phone cases in India — pink, floral, aesthetic and love-themed designs in premium glossy finish." },
    ],
  },
};

function CollectionSEOContent({ slug, name }: { slug: string; name: string }) {
  const copy = COLLECTION_COPY[slug];
  if (!copy) return null;

  // Inject FAQ JSON-LD
  React.useEffect(() => {
    const old = document.getElementById("collection-faq-ld");
    if (old) old.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "collection-faq-ld";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": copy.faqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a },
      })),
    });
    document.head.appendChild(script);
    return () => { document.getElementById("collection-faq-ld")?.remove(); };
  }, [slug]);

  return (
    <div className="mt-16 border-t border-zinc-100 pt-10">
      <h2 className="text-lg font-sans font-black uppercase tracking-tight text-zinc-800 mb-3">
        {copy.heading}
      </h2>
      <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl mb-8">{copy.body}</p>

      {copy.faqs.length > 0 && (
        <div className="space-y-3 max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Common Questions</p>
          {copy.faqs.map((f, i) => (
            <details key={i} className="group border border-zinc-100 rounded-lg">
              <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-zinc-700 list-none flex justify-between items-center select-none">
                {f.q}
                <span className="text-zinc-300 group-open:rotate-45 transition-transform text-base leading-none">+</span>
              </summary>
              <p className="px-4 pb-4 pt-1 text-xs text-zinc-400 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
