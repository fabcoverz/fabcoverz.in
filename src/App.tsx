import React, { useState, useEffect, lazy, Suspense } from "react";
import { initDB, getProducts, getCollections, getBanners, getSettings, getReviews } from "./utils/remoteStore";
import { Product, Collection, Banner, StoreSettings, CartItem, ReviewItem } from "./types";
import { trackPageView, trackAddToCart } from "./utils/metaPixel";
import { useVisitorTracking } from "./utils/useVisitorTracking";
import { seoHome, seoCollections, seoCollectionDetail, seoProduct, seoPolicy, setSEOSettings } from "./utils/useSEO";
import { cdnCollectionImg } from "./utils/cloudinary";

// ── Always-visible (no lazy) ──────────────────────────────────────────────────
import { AnnouncementBar } from "./components/AnnouncementBar";
import { Navbar } from "./components/Navbar";
import { HeroSlider } from "./components/HeroSlider";
import { PhoneMockup } from "./components/PhoneMockup";
import { ProductCard } from "./components/ProductCard";
import { CartDrawer } from "./components/CartDrawer";
import { UpsellModal } from "./components/UpsellModal";
import { SearchModal } from "./components/SearchModal";

// ── Lazy loaded — only downloaded when user navigates there ───────────────────
const CollectionsPage     = lazy(() => import("./components/CollectionsPage").then(m => ({ default: m.CollectionsPage })));
const CollectionDetailPage = lazy(() => import("./components/CollectionDetailPage").then(m => ({ default: m.CollectionDetailPage })));
const ProductPage         = lazy(() => import("./components/ProductPage").then(m => ({ default: m.ProductPage })));
const CheckoutPage        = lazy(() => import("./components/CheckoutPage").then(m => ({ default: m.CheckoutPage })));
const AdminPanel          = lazy(() => import("./components/AdminPanel").then(m => ({ default: m.AdminPanel })));
const FAQSection          = lazy(() => import("./components/FAQSection").then(m => ({ default: m.FAQSection })));
const LiveDashboard       = lazy(() => import("./components/LiveDashboard").then(m => ({ default: m.LiveDashboard })));
const TrackOrderPage      = lazy(() => import("./components/TrackOrderPage").then(m => ({ default: m.TrackOrderPage })));
const OurSnapsPage        = lazy(() => import("./components/OurSnapsPage").then(m => ({ default: m.OurSnapsPage })));

import { Footer } from "./components/Footer";
import { TopSellingScroll } from "./components/TopSellingScroll";
import { PolicyPage } from "./components/PolicyPage";

import { 
  Sparkles, ShieldCheck,
  ChevronRight, RefreshCw
} from "lucide-react";

// Detect admin route or product deep-link from URL
/** Extract product id from /products/<slug>--<id> style URLs */
function extractProductIdFromPath(path: string): string | null {
  if (path.startsWith("/products/")) {
    const segment = path.replace("/products/", "");
    // Format: <slug>--<id>  e.g. trending-butterfly-metal-glossy-case--prod-727971
    const idx = segment.lastIndexOf("--");
    if (idx !== -1) return segment.slice(idx + 2);
    // Slug-only URL (Google Merchant feed format): /products/<slug>
    // Return the slug itself so we can do title-based lookup after products load
    return segment || null;
  }
  return null;
}

/** Convert product title → clean URL slug (mirrors generateMerchantFeed.ts) */
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Build unique slug map matching generateMerchantFeed.ts logic */
function buildUniqueSlugMap(products: Array<{ id: string; title: string }>): Map<string, string> {
  const slugCount: Record<string, number> = {};
  const map = new Map<string, string>();
  for (const p of products) {
    const base = titleToSlug(p.title);
    slugCount[base] = (slugCount[base] || 0) + 1;
    const count = slugCount[base];
    map.set(p.id, count === 1 ? base : `${base}-${count}`);
  }
  return map;
}

/** Resolve product id from slug-only URL (Google Merchant feed links) */
function resolveProductBySlug(slug: string, products: Array<{ id: string; title: string }>): string | null {
  const slugMap = buildUniqueSlugMap(products);
  for (const [id, s] of slugMap.entries()) {
    if (s === slug) return id;
  }
  return null;
}

function getInitialPage(): string {
  if (typeof window !== "undefined") {
    const hash = window.location.hash;
    const path = window.location.pathname;
    if (path === "/admin" || hash === "#/admin") return "admin";
    if (path === "/live"  || hash === "#/live")  return "live";
if (path === "/collections") return "collections";
    if (path.startsWith("/collections/")) return "collection_detail";
    if (path.startsWith("/policy/")) return "policy";
    if (path === "/track") return "track_order";
    // New clean product URL: /products/<slug>--<id>
    if (path.startsWith("/products/") && extractProductIdFromPath(path)) return "product_detail";
    const params = new URLSearchParams(window.location.search);
    if (params.get("product")) return "product_detail";
  }
  return "home";
}

function getInitialProductId(): string | null {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    // New clean URL format first
    const fromPath = extractProductIdFromPath(path);
    if (fromPath) return fromPath;
    // Legacy ?product= param (still supported)
    const params = new URLSearchParams(window.location.search);
    return params.get("product") || null;
  }
  return null;
}

function getInitialCollectionSlug(): string | null {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.startsWith("/collections/")) {
      const rest = path.replace("/collections/", "") || null;
      if (!rest) return null;
      // Could be "slug" or "slug/subcollection-id"
      const parts = rest.split("/");
      return parts[0] || null;
    }
  }
  return null;
}

function getInitialSubCollectionId(): string | null {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.startsWith("/collections/")) {
      const rest = path.replace("/collections/", "") || "";
      const parts = rest.split("/");
      return parts[1] || null;
    }
  }
  return null;
}

function getInitialPolicyPage(): "privacy" | "shipping" | "terms" | "refund" {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.startsWith("/policy/")) {
      const type = path.replace("/policy/", "") as "privacy" | "shipping" | "terms" | "refund";
      if (["privacy", "shipping", "terms", "refund"].includes(type)) return type;
    }
  }
  return "privacy";
}

export default function App() {
  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(getInitialProductId);
  const [selectedCollectionSlug, setSelectedCollectionSlug] = useState<string | null>(getInitialCollectionSlug);
  const [selectedSubCollectionId, setSelectedSubCollectionId] = useState<string | null>(getInitialSubCollectionId);
  const [activePolicyPage, setActivePolicyPage] = useState<"privacy" | "shipping" | "terms" | "refund">(getInitialPolicyPage);

  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  const [cartOpen, setCartOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("fabcoverz_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initDB()
      .then(() => refreshData())
      .catch(() => setDataError("Could not connect to the server. Please refresh the page."));
  }, []);

  // Track page views on every route change
  useEffect(() => {
    trackPageView();
  }, [currentPage]);

  // ── Dynamic SEO: update <title>, meta, OG, JSON-LD per page ──
  useEffect(() => {
    if (currentPage === "home") {
      seoHome();
    } else if (currentPage === "collections") {
      seoCollections();
    } else if (currentPage === "collection_detail" && selectedCollectionSlug) {
      const col = collections.find(c => c.slug === selectedCollectionSlug);
      seoCollectionDetail(
        selectedCollectionSlug,
        col?.name || selectedCollectionSlug,
        col?.image && col.image.startsWith("http") ? col.image : undefined
      );
    } else if (currentPage === "product_detail" && selectedProductId) {
      const prod = products.find(p => p.id === selectedProductId);
      if (prod) {
        seoProduct(
          prod.id,
          prod.title,
          prod.description || "",
          prod.price,
          prod.images?.[0] && prod.images[0].startsWith("http") ? prod.images[0] : undefined,
          prod.stock === 0 ? "OutOfStock" : "InStock"
        );
      }
    } else if (currentPage === "policy") {
      seoPolicy(activePolicyPage);
    }
  }, [currentPage, selectedProductId, selectedCollectionSlug, activePolicyPage, products, collections]);

  // Live visitor tracking (non-admin pages only)
  useVisitorTracking({
    page: checkoutOpen ? "checkout" : currentPage,
    cartCount: cartItems.reduce((a, i) => a + i.quantity, 0),
    disabled: currentPage === "admin",
  });

  // Sync URL with current page (only for admin transitions, others handled in handleNavigation)
  useEffect(() => {
    if (currentPage === "admin") {
      window.history.replaceState(null, "", "/admin");
    } else if (currentPage === "home") {
      if (window.location.pathname === "/admin") {
        window.history.replaceState(null, "", "/");
      }
    }
  }, [currentPage]);

  // Handle browser back/forward and direct URL load
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const productId = params.get("product");
      if (path === "/admin") {
        setCurrentPage("admin");
      } else if (path === "/collections") {
        setCurrentPage("collections");
        setSelectedProductId(null);
      } else if (path.startsWith("/collections/")) {
        const rest = path.replace("/collections/", "");
        const parts = rest.split("/");
        const slug = parts[0];
        const subId = parts[1] || null;
        setSelectedCollectionSlug(slug);
        setSelectedSubCollectionId(subId);
        setCurrentPage("collection_detail");
        setSelectedProductId(null);
      } else if (path.startsWith("/policy/")) {
        const type = path.replace("/policy/", "") as "privacy" | "shipping" | "terms" | "refund";
        if (["privacy", "shipping", "terms", "refund"].includes(type)) {
          setActivePolicyPage(type);
        }
        setCurrentPage("policy");
        setSelectedProductId(null);
      } else if (path === "/track") {
        setCurrentPage("track_order");
        setSelectedProductId(null);
      } else if (path.startsWith("/products/")) {
        const idFromPath = extractProductIdFromPath(path);
        if (idFromPath) {
          setSelectedProductId(idFromPath);
          setCurrentPage("product_detail");
        } else {
          setCurrentPage("home");
          setSelectedProductId(null);
        }
      } else if (productId) {
        setSelectedProductId(productId);
        setCurrentPage("product_detail");
      } else {
        setCurrentPage("home");
        setSelectedProductId(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  async function refreshData() {
    setIsLoading(true);
    try {
      // onFresh callbacks — called when background revalidation completes
      // This silently updates state if fresh data differs from cache
      const onFreshProducts = (fresh: typeof products) => {
        setProducts(fresh);
        setCartItems(prev => {
          const validIds = new Set(fresh.map(p => p.id));
          return prev.filter(item => validIds.has(item.product.id));
        });
      };

      const [prods, cols, bans, stg, revs] = await Promise.all([
        getProducts(onFreshProducts),
        getCollections(cols => setCollections(cols)),
        getBanners(),
        getSettings(),
        getReviews(),
      ]);
      setProducts(prods);
      setCollections(cols);
      setBanners(bans.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setSettings(stg);
      // Sync SEO settings to useSEO runtime so Admin-edited SEO values take effect immediately
      if (stg) {
        setSEOSettings({
          seoHomeTitle: stg.seoHomeTitle,
          seoHomeDescription: stg.seoHomeDescription,
          seoHomeKeywords: stg.seoHomeKeywords,
          seoCollectionOverrides: stg.seoCollectionOverrides,
        });
      }
      setReviews(revs);

      // Reconcile cart — remove items for deleted products
      setCartItems(prev => {
        const validIds = new Set(prods.map(p => p.id));
        const valid = prev.filter(item => validIds.has(item.product.id));
        if (valid.length < prev.length) {
          console.warn("Some cart items were removed because products are no longer available.");
        }
        return valid;
      });
    } finally {
      setIsLoading(false);
    }
  }

  const hasLoadedRef = React.useRef(false);
  useEffect(() => {
    if (currentPage !== "admin" && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      refreshData();
    }
    // Still allow explicit refresh when going back to home from admin
    if (currentPage === "home" && hasLoadedRef.current) {
      refreshData();
    }
  }, [currentPage]);

  // After products load from DB, resolve product from URL
  useEffect(() => {
    if (products.length > 0) {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);

      // Legacy ?product= param
      const productIdFromUrl = params.get("product");
      if (productIdFromUrl) {
        const found = products.find((p) => p.id === productIdFromUrl);
        if (found) {
          setSelectedProductId(productIdFromUrl);
          setCurrentPage("product_detail");
          return;
        }
      }

      // /products/<slug>--<id> or /products/<slug> (Google Merchant feed links)
      if (path.startsWith("/products/")) {
        const segment = path.replace("/products/", "");
        const doubleIdx = segment.lastIndexOf("--");
        if (doubleIdx !== -1) {
          // Has --id suffix: direct ID lookup
          const id = segment.slice(doubleIdx + 2);
          if (products.find(p => p.id === id)) {
            setSelectedProductId(id);
            setCurrentPage("product_detail");
            return;
          }
        }
        // Slug-only: resolve by title match (Google Merchant feed URL)
        const resolvedId = resolveProductBySlug(segment, products);
        if (resolvedId) {
          setSelectedProductId(resolvedId);
          setCurrentPage("product_detail");
          // Upgrade URL to include id for future navigation
          const prod = products.find(p => p.id === resolvedId)!;
          const slug = titleToSlug(prod.title);
          window.history.replaceState(null, "", `/products/${slug}--${resolvedId}`);
        }
      }
    }
  }, [products]);

  useEffect(() => {
    try {
      // Strip base64 images before saving to avoid QuotaExceededError
      const cartToSave = cartItems.map(item => ({
        ...item,
        customerImage: item.customerImage?.startsWith("data:") ? "__needs_reupload__" : item.customerImage,
      }));
      localStorage.setItem("fabcoverz_cart", JSON.stringify(cartToSave));
    } catch (e) {
      console.warn("Cart save failed (storage quota):", e);
    }
  }, [cartItems]);

  const handleAddToCart = (item: CartItem) => {
    let wasEmpty = false;
    setCartItems((prev) => {
      wasEmpty = prev.length === 0;
      const matchIndex = prev.findIndex(
        (i) => i.product.id === item.product.id && i.selectedModel === item.selectedModel && i.customText === item.customText
      );
      if (matchIndex > -1) {
        const updated = [...prev];
        updated[matchIndex].quantity += item.quantity;
        return updated;
      }
      return [...prev, item];
    });
    // Show upsell popup only when adding first item to an empty cart
    if (wasEmpty) {
      setUpsellOpen(true);
    } else {
      setCartOpen(true);
    }
    // Meta Pixel: AddToCart
    trackAddToCart({
      productId: item.product.id,
      productName: item.product.title,
      price: item.product.price,
      quantity: item.quantity,
    });
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) { handleRemoveItem(index); return; }
    setCartItems((prev) => { const u = [...prev]; u[index].quantity = newQty; return u; });
  };

  const handleRemoveItem = (index: number) => setCartItems((prev) => prev.filter((_, i) => i !== index));
  const handleClearCart = () => setCartItems([]);

  const handleNavigation = (page: string) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Clear product param from URL when leaving product page
    const url = new URL(window.location.href);
    url.searchParams.delete("product");

    if (page.startsWith("policy-")) {
      const policyType = page.replace("policy-", "") as "privacy" | "shipping" | "terms" | "refund";
      setActivePolicyPage(policyType);
      setCurrentPage("policy");
      window.history.pushState(null, "", `/policy/${policyType}`);
    } else if (page.startsWith("collection-")) {
      const rest = page.replace("collection-", "");
      // Support "slug" or "slug/subcollection-id"
      const parts = rest.split("/");
      const slug = parts[0];
      const subId = parts[1] || null;
      setSelectedCollectionSlug(slug);
      setSelectedSubCollectionId(subId);
      setCurrentPage("collection_detail");
      window.history.pushState(null, "", subId ? `/collections/${slug}/${subId}` : `/collections/${slug}`);
    } else if (page === "collections") {
      setCurrentPage("collections");
      window.history.pushState(null, "", "/collections");
    } else if (page === "track_order") {
      setCurrentPage("track_order");
    } else if (page === "our_snaps") {
      setCurrentPage("our_snaps");
      window.history.pushState(null, "", "/track");
    } else if (page === "home") {
      setCurrentPage("home");
      window.history.pushState(null, "", "/");
    } else {
      url.pathname = page === "admin" ? "/admin" : "/";
      window.history.replaceState(null, "", url.toString());
      setCurrentPage(page);
    }
  };

  const handleSelectProduct = (product: Product) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setSelectedProductId(product.id);
    setCurrentPage("product_detail");
    // Clean SEO-friendly URL: /products/<slug>--<id>
    const slug = product.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    window.history.pushState(null, "", `/products/${slug}--${product.id}`);
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedCollection = collections.find((c) => c.slug === selectedCollectionSlug);
  const cartCountSum = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

  // Maintenance mode — block all non-admin access
  if (settings?.maintenanceMode && currentPage !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-[#000000]/10 flex items-center justify-center border border-[#000000]/20">
          <svg className="w-8 h-8 text-[#000000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-6.836" /></svg>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#000000] tracking-widest uppercase mb-3">Maintenance Mode</p>
          <h1 className="text-2xl font-black text-white mb-3">Store Temporarily Offline</h1>
          <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">{settings.maintenanceMessage || "We are updating our store. Back shortly!"}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          <span>fabcoverz.store · Coming back soon</span>
        </div>
      </div>
    );
  }

  // Live dashboard — fullscreen, no navbar/footer
  if (currentPage === "live") {
    return <Suspense fallback={<div className="min-h-screen bg-zinc-900 flex items-center justify-center"><div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /></div>}><LiveDashboard /></Suspense>;
  }

  // Admin page renders fullscreen — no navbar/footer
  if (currentPage === "admin") {
    return <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#000000] border-t-transparent rounded-full animate-spin" /></div>}><AdminPanel onExitAdmin={() => { handleNavigation("home"); }} /></Suspense>;
  }

  // Checkout page renders fullscreen
  if (checkoutOpen) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#000000] border-t-transparent rounded-full animate-spin" /></div>}>
        <CheckoutPage
          cartItems={cartItems}
          onClearCart={handleClearCart}
          onBack={() => { setCheckoutOpen(false); setCurrentPage("home"); }}
          freeShippingThreshold={settings?.freeShippingThreshold || 499}
          codEnabled={settings?.codEnabled !== false}
          coupons={settings?.coupons || []}
          currencySymbol={settings?.currencySymbol || "₹"}
          taxRate={settings?.taxRate || 0}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#111] flex flex-col justify-between font-sans selection:bg-[#000000]/20">

      <AnnouncementBar announcements={settings?.announcements?.length ? settings.announcements : [{ id: "default-1", text: "SHIPPING: ₹50 (TAMIL NADU) · ₹100 (OTHER STATES)" }, { id: "default-2", text: "BUY 2 GET ₹50 INSTANT DISCOUNT" }]} />
      <Navbar currentPage={currentPage} onNavigate={handleNavigation} cartCount={cartCountSum} onOpenCart={() => setCartOpen(true)} onOpenSearch={() => setSearchOpen(true)} settings={settings} />

      <main className="flex-grow">
        {currentPage === "home" && (
          <div className="animate-fade-in space-y-16">
            <HeroSlider banners={banners} onNavigate={(link) => {
                if (link.startsWith("/collections/")) {
                  const slug = link.replace("/collections/", "");
                  setSelectedCollectionSlug(slug);
                  setCurrentPage("collection_detail");
                } else { handleNavigation("collections"); }
              }} />



            <section className="max-w-7xl mx-auto px-6 lg:px-10">
              <div className="text-center mb-8 select-none">
                <h2 className="text-3xl md:text-5xl font-sans font-black tracking-tight uppercase text-zinc-900">{settings?.trendingSectionTitle || "Trending Now"}</h2>
                <p className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase mt-2">{settings?.trendingSectionSubtitle || "Highly requested collections"}</p>
                <button onClick={() => handleNavigation("collections")} className="text-xs font-bold text-[#000000] border-b border-[#000000] pb-0.5 bg-transparent cursor-pointer mt-4 inline-block">View All Categories</button>
              </div>
              {dataError && (
                <div className="max-w-lg mx-auto mt-4 mb-8 text-center px-4">
                  <p className="text-red-600 font-bold mb-3">{dataError}</p>
                  <button
                    onClick={() => { setDataError(null); initDB().then(() => refreshData()); }}
                    className="bg-[#000000] text-white text-sm font-bold px-5 py-2.5 rounded-xl"
                  >
                    Retry
                  </button>
                </div>
              )}
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 px-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-zinc-100 rounded-2xl animate-pulse" style={{ aspectRatio: "3/4" }} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 px-1">
                {(() => {
                  const ORDER = ["photo-cases", "god-cases", "tvk-cases", "trendy-cases", "girly-cases"];
                  const visible = collections.filter(c => c.isVisible !== false);
                  const base = settings?.collectionOrder && settings.collectionOrder.length > 0
                    ? [...visible].sort((a, b) => {
                        const oa = settings.collectionOrder!.indexOf(a.slug);
                        const ob = settings.collectionOrder!.indexOf(b.slug);
                        return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
                      })
                    : [...visible].sort((a, b) => {
                        const oa = ORDER.indexOf(a.slug);
                        const ob = ORDER.indexOf(b.slug);
                        return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
                      });
                  return base;
                })().map((coll) => (
                  <div key={coll.id} onClick={() => handleNavigation(`collection-${coll.slug}`)} className="group bg-white border border-zinc-200/80 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md cursor-pointer text-center relative">
                    <div className="bg-zinc-50 w-full relative overflow-hidden select-none" style={{aspectRatio:"1/1"}}>
                      {coll.image && (coll.image.startsWith("data:") || coll.image.startsWith("http://") || coll.image.startsWith("https://")) ? (
                        <img src={cdnCollectionImg(coll.image)} alt={coll.name} loading="lazy" decoding="async" className="w-full h-full object-contain transform transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center transform transition-transform duration-500 group-hover:scale-105">
                          <PhoneMockup designId={coll.image} size="sm" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-sans font-black italic text-base sm:text-lg text-zinc-900 group-hover:text-[#000000] transition-colors flex items-center justify-start gap-1 px-4 py-4 uppercase tracking-wide select-none">
                      <span>{coll.name}</span>
                      <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#000000] transition-transform group-hover:translate-x-0.5 shrink-0" />
                    </h3>
                  </div>
                ))}
              </div>
              )}
            </section>

            {/* Top Selling Scroll */}
            {(() => {
              const topIds = settings?.topSellingProductIds || [];
              const topProducts = topIds.length > 0
                ? topIds.map(id => products.find(p => p.id === id)).filter(Boolean) as typeof products
                : products.filter(p => p.isBestSeller || p.isTrending).slice(0, 10);
              return topProducts.length > 0 ? (
                <TopSellingScroll
                  products={topProducts}
                  title={settings?.topSellingTitle || "Top Selling Products"}
                  onSelectProduct={handleSelectProduct}
                />
              ) : null;
            })()}

            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4">
              <div className="text-center mb-10 pb-4 border-b border-zinc-100 select-none">
                <span className="inline-block px-3 py-1 bg-zinc-900 text-white text-[9px] font-sans tracking-[0.2em] uppercase w-fit select-none mb-3.5 rounded-md">{settings?.bestsellerSectionBadge || "EXCLUSIVE DESIGN CATALOG"}</span>
                <h2 className="text-2xl md:text-3xl font-sans tracking-tight font-black text-zinc-900 uppercase">{settings?.bestsellerSectionTitle || "Bestselling Metal Glossy Cases"}</h2>
                <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto">{settings?.bestsellerSectionSubtitle || "Symmetric triple protection lens grids overlaid on robust high fidelity glossy prints."}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 px-1">
                {(() => {
                  const metalIds = settings?.bestSellingMetalProductIds || [];
                  const metalProds = metalIds.length > 0
                    ? metalIds.map(id => products.find(p => p.id === id)).filter(Boolean) as typeof products
                    : products.slice(0, 16);
                  return metalProds.map((prod) => <ProductCard key={prod.id} product={prod} onSelect={handleSelectProduct} />);
                })()}
              </div>
            </section>

            <section id="about-us" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12 border-t border-zinc-100 scroll-mt-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-6 space-y-4 text-left">
                  <span className="inline-block px-3 py-1 bg-zinc-900 text-white text-[9px] font-sans tracking-[0.2em] uppercase rounded-md">{settings?.bannerStoryBadge || "OUR BRAND STORY"}</span>
                  <h2 className="text-2xl md:text-3xl font-sans tracking-tight font-black text-zinc-900 uppercase">{settings?.aboutSectionTitle || "Premium Durability Meets Modern Aesthetics"}</h2>
                  <p className="text-xs text-zinc-500 leading-relaxed">{settings?.aboutSectionSubtitle || "At FabCoverz, we believe your phone is an extension of your individual personality."}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{settings?.aboutSectionDesc1 || "Based proudly in Chennai, India, our team has built a community around custom lettering, spiritual/faith-focused graphics, and bold pop-culture cases."}</p>
                  {settings?.aboutSectionDesc2 && <p className="text-xs text-zinc-500 leading-relaxed">{settings.aboutSectionDesc2}</p>}
                </div>
                <div className="lg:col-span-6 grid grid-cols-2 gap-4 text-left">
                  <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-all space-y-2">
                    <span className="text-lg"></span>
                    <h4 className="text-xs font-bold uppercase text-zinc-900 tracking-wider">{settings?.reassuranceCard1Title || "Reinforced Metal Finish"}</h4>
                    <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">{settings?.reassuranceCard1Body || "Provides legendary drops protection with precise button covers."}</p>
                  </div>
                  <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-all space-y-2">
                    <span className="text-lg"></span>
                    <h4 className="text-xs font-bold uppercase text-zinc-900 tracking-wider">{settings?.reassuranceCard2Title || "Fade-Resistant Gloss"}</h4>
                    <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">{settings?.reassuranceCard2Body || "Anti-scratch coated protective backing stays brilliantly mirror-reflective."}</p>
                  </div>
                </div>
              </div>
            </section>

            <section id="reviews" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12 border-t border-zinc-100 scroll-mt-20">
              <div className="text-center mb-10 pb-4 select-none">
                <span className="inline-block px-3 py-1 bg-zinc-900 text-white text-[9px] font-sans tracking-[0.2em] uppercase rounded-md mb-3.5">{settings?.reviewsBadge || "COMMUNITY LOVE"}</span>
                <h2 className="text-2xl md:text-3xl font-sans tracking-tight font-black text-zinc-900 uppercase">{settings?.reviewsTitle || "Verified Customer Reviews"}</h2>
                <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto">{settings?.reviewsSubtitle || "See what our 45,000+ happy cover collectors are saying about us."}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                {reviews.map((testimonial) => (
                  <div key={testimonial.id || testimonial.name} className="bg-zinc-50/50 p-6 rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-all space-y-4">
                    <div className="flex items-center gap-1 text-amber-500 text-sm">{[...Array(testimonial.rating || 5)].map((_, i) => <span key={i} className="font-bold">*</span>)}</div>
                    <p className="text-xs text-zinc-600 leading-relaxed font-semibold italic">"{testimonial.review}"</p>
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-[10px] uppercase font-sans">
                      <div><span className="font-bold text-zinc-900 block">{testimonial.name}</span><span className="text-zinc-400">{testimonial.location}</span></div>
                      {testimonial.verified && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">Verified Buyer</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 border-t border-zinc-100 scroll-mt-20">
              <div className="text-center mb-12 select-none">
                <span className="inline-block px-3 py-1 bg-zinc-900 text-white text-[9px] font-sans tracking-[0.2em] uppercase rounded-md mb-3">{settings?.contactSectionBadge || "SUPPORT ASSISTANCE"}</span>
                <h2 className="text-2xl md:text-3xl font-sans tracking-tight font-black text-zinc-900 uppercase">{settings?.contactSectionTitle || "Get In Touch With Support"}</h2>
                <p className="text-xs text-zinc-450 mt-2 max-w-md mx-auto">{settings?.contactSectionSubtitle || "Have any questions about compatible mobile models, shipping times, or customizing your lettering?"}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-white border border-zinc-200/80 p-6 rounded-2xl flex flex-col items-center text-center space-y-4">
                  <div>
                    <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-zinc-400">Email Address</h3>
                    <p className="text-sm font-black text-zinc-900 mt-1"><a href={`mailto:${settings?.contactEmail || "support@fabcoverz.com"}`} className="text-zinc-900 hover:underline">{settings?.contactEmail || "support@fabcoverz.com"}</a></p>
                  </div>
                  <p className="text-[11px] text-zinc-400">Response guaranteed in 3-5 hours</p>
                </div>
                <div className="bg-white border border-zinc-200/80 p-6 rounded-2xl flex flex-col items-center text-center space-y-4">
                  <div>
                    <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-zinc-400">Call / Message</h3>
                    <p className="text-sm font-black text-zinc-900 mt-1">{settings?.contactPhone || "+91 98765 43210"}</p>
                  </div>
                  <p className="text-[11px] text-zinc-400">Customer Helpline Support</p>
                </div>
                <div className="bg-white border border-zinc-200/80 p-6 rounded-2xl flex flex-col items-center text-center space-y-4">
                  <div>
                    <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-zinc-400">Location</h3>
                    <p className="text-sm font-black text-zinc-900 mt-1">{settings?.contactAddress || "Chennai, Tamil Nadu, India"}</p>
                  </div>
                  <p className="text-[11px] text-zinc-400">Fast Shipping All Over India</p>
                </div>
              </div>
            </section>

            <FAQSection />

          </div>
        )}

        {currentPage === "policy" && (
          <PolicyPage
            page={activePolicyPage}
            onGoBack={() => handleNavigation("home")}
          />
        )}

        {currentPage === "track_order" && (
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#000000] border-t-transparent rounded-full animate-spin" /></div>}>
            <TrackOrderPage onGoBack={() => handleNavigation("home")} />
          </Suspense>
        )}

        {currentPage === "our_snaps" && (
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#000000] border-t-transparent rounded-full animate-spin" /></div>}>
            <OurSnapsPage
              snaps={settings?.instagramSnaps ?? []}
              onGoBack={() => handleNavigation("home")}
            />
          </Suspense>
        )}

<Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#000000] border-t-transparent rounded-full animate-spin" /></div>}>

        {currentPage === "collections" && (
          <CollectionsPage
            collections={collections}
            products={products}
            onSelectCollection={(slug) => handleNavigation(`collection-${slug}`)}
            onSelectProduct={handleSelectProduct}
            collectionOrder={settings?.collectionOrder}
            topSellingTitle={settings?.topSellingTitle}
            topSellingProductIds={settings?.topSellingProductIds}
          />
        )}

        {currentPage === "collection_detail" && selectedCollection && (
          <CollectionDetailPage
            collection={selectedCollection}
            products={products.filter((p) => (p.collectionIds?.length ? p.collectionIds : [p.collectionId]).includes(selectedCollection.slug))}
            onSelectProduct={handleSelectProduct}
            onGoBack={() => handleNavigation("collections")}
            productOrder={settings?.productOrder?.[selectedCollection.slug] ?? []}
            subcollectionProductOrder={settings?.subcollectionProductOrder ?? {}}
            initialSubCollectionId={selectedSubCollectionId}
            onSubCollectionChange={(subId) => {
              setSelectedSubCollectionId(subId);
              const base = `/collections/${selectedCollection.slug}`;
              window.history.pushState(null, "", subId ? `${base}/${subId}` : base);
            }}
            allCollections={collections}
          />
        )}

        {currentPage === "product_detail" && selectedProduct && (
          <ProductPage
            product={selectedProduct}
            allProducts={products}
            allCollections={collections}
            onAddToCart={handleAddToCart}
            onSelectProduct={(p) => {
              handleSelectProduct(p);
            }}
            settings={settings}
            onGoBack={() => {
              if (selectedCollectionSlug) handleNavigation(`collection-${selectedCollectionSlug}`);
              else handleNavigation("home");
            }}
          />
        )}

        {currentPage === "product_detail" && !selectedProduct && products.length > 0 && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="text-lg font-bold text-zinc-800">Product not found</p>
            <p className="text-sm text-zinc-500">This product may have been removed or the link is invalid.</p>
            <button
              onClick={() => handleNavigation("home")}
              className="bg-[#000000] text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-[#0066cc] transition"
            >
              Go to Home
            </button>
          </div>
        )}
        </Suspense>

      </main>

      <Footer onNavigate={handleNavigation} settings={settings} collections={collections} />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        freeShippingThreshold={settings?.freeShippingThreshold || 499}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); setCurrentPage("checkout"); }}
      />

      <UpsellModal
        isOpen={upsellOpen}
        discount={50}
        onAddAnother={() => {
          setUpsellOpen(false);
          // Stay on current page so user can continue shopping
        }}
        onCheckout={() => {
          setUpsellOpen(false);
          setCheckoutOpen(true);
          setCurrentPage("checkout");
        }}
      />

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        collections={collections}
        onSelectProduct={(product) => {
          setSearchOpen(false);
          handleSelectProduct(product);
        }}
        onSelectCollection={(slug) => {
          setSearchOpen(false);
          handleNavigation(`collection-${slug}`);
        }}
      />

      {/* WhatsApp floating button */}
      {settings?.whatsappEnabled !== false && settings?.whatsappNumber && (
        <a
          href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Chat with us on WhatsApp"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center"
          style={{ boxShadow: "0 4px 20px rgba(37,211,102,0.4)" }}
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}
    </div>
  );
}
