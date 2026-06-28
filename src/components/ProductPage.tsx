import React, { useState, useEffect, useRef } from "react";
import { 
  Star, Truck, ShieldCheck, Heart, RefreshCw, ShoppingBag, 
  MapPin, CheckCircle, Smartphone, Edit3, ClipboardList, Zap, Share2
} from "lucide-react";
import { Product, CartItem, StoreSettings, Collection } from "../types";
import { PhoneMockup } from "./PhoneMockup";
import { DEFAULT_BRAND_MODELS } from "../utils/brandModels";
import { TopSellingScroll } from "./TopSellingScroll";
import { trackViewContent } from "../utils/metaPixel";
import { cdnImg, cdnThumb, cdnLqip, cdnSrcSet, processAndUpload } from "../utils/cloudinary";

interface ProductPageProps {
  product: Product;
  allProducts?: Product[];
  allCollections?: Collection[];
  onAddToCart: (item: CartItem) => void;
  onGoBack: () => void;
  onSelectProduct?: (product: Product) => void;
  settings?: StoreSettings | null;
}

export const ProductPage: React.FC<ProductPageProps> = ({
  product,
  allProducts = [],
  allCollections = [],
  onAddToCart,
  onGoBack,
  onSelectProduct,
  settings,
}) => {
  const BRAND_MODELS = settings?.brandModels || DEFAULT_BRAND_MODELS;

  // State initialized to empty strings so neither is default selected
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [customText, setCustomText] = useState("");
  const [customerImage, setCustomerImage] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);

  // Determine if this is a photo case collection
  // Helper: all collections this product belongs to
  const productCollIds = product.collectionIds?.length ? product.collectionIds : [product.collectionId];

  const isPhotoCase = productCollIds.includes("photo-cases");
  const isPhotoNameCase = productCollIds.includes("photo-name-cases") || (isPhotoCase && (product.tags ?? []).includes("name"));
  const requiresCustomerImage = isPhotoCase || isPhotoNameCase;
  const requiresCustomText = productCollIds.includes("name-cases") || isPhotoNameCase;

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError("Image must be under 10MB.");
      return;
    }
    setImageUploadError(null);
    setCustomerImage("uploading");
    try {
      const url = await processAndUpload(file, 1200, 1500, "fabcoverz/customer-photos");
      setCustomerImage(url);
    } catch (err) {
      setCustomerImage(null);
      setImageUploadError("Image upload failed. Please try again.");
    }
  };
  const [cartSuccess, setCartSuccess] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [mainImgLoaded, setMainImgLoaded] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleSwipe = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) < 40) return; // too small, ignore
    const total = product.images?.length || 1;
    if (diff > 0) {
      // swipe left → next
      setActiveImgIdx(i => (i + 1) % total);
    } else {
      // swipe right → prev
      setActiveImgIdx(i => (i - 1 + total) % total);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Reset active image index and selection states on product change
  useEffect(() => {
    setActiveImgIdx(0);
    setMainImgLoaded(false);
    setSelectedBrand("");
    setSelectedModel("");
    setSelectionError(null);

    // Inject <link rel=preload> for the first product image so browser fetches it at highest priority
    const firstImg = product.images?.[0];
    if (firstImg && firstImg.includes("res.cloudinary.com")) {
      const preloadUrl = firstImg.replace("/upload/", "/upload/f_auto,q_auto:good,w_800,c_limit/");
      const existing = document.head.querySelector(`link[data-fabcoverz-preload]`);
      if (existing) existing.remove();
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = preloadUrl;
      link.setAttribute("data-fabcoverz-preload", "1");
      document.head.appendChild(link);
    }

    // Meta Pixel: ViewContent
    trackViewContent({
      productId: product.id,
      productName: product.title,
      price: product.price,
    });
  }, [product.id]);

  // ── SEO: Inject Product + Review JSON-LD for Google Rich Results (stars) ──
  useEffect(() => {
    const BASE = "https://www.fabcoverz.store";
    const productImage = product.images?.[0]?.startsWith("http")
      ? product.images[0]
      : `${BASE}/assets/logo/round_logo.png`;

    // Build category list from all collections this product belongs to
    const productAllCollIds = product.collectionIds?.length ? product.collectionIds : [product.collectionId];
    const categoryNames = productAllCollIds
      .map(id => allCollections.find(c => c.slug === id)?.name || id)
      .join(", ");

    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.title,
      "image": productImage,
      "description": product.description || `Buy ${product.title} online in India. Premium quality phone case from FabCoverz.`,
      "category": categoryNames,
      "brand": { "@type": "Brand", "name": "FabCoverz" },
      "offers": {
        "@type": "Offer",
        "price": product.price,
        "priceCurrency": "INR",
        "availability": product.stockStatus === "out_of_stock"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
        "url": `${BASE}/?product=${product.id}`,
        "seller": { "@type": "Organization", "name": "FabCoverz" },
      },
    };

    // AggregateRating — use real data or seeded fallback (same formula as UI)
    const _s  = product.id.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
    const _rv = (product.rating && product.rating > 0)
      ? product.rating
      : parseFloat((4.2 + ((_s * 9301 + 49297) % 233280) / 233280 * 0.7).toFixed(1));
    const _rc = (product.reviewsCount && product.reviewsCount > 0)
      ? product.reviewsCount
      : Math.floor(200 + ((_s * 7919 + 12345) % 199999) / 199999 * 201);
    schema["aggregateRating"] = {
      "@type": "AggregateRating",
      "ratingValue": _rv.toFixed(1),
      "bestRating": "5",
      "worstRating": "1",
      "reviewCount": _rc,
    };

    // Inject / replace dynamic product schema
    const old = document.getElementById("product-json-ld");
    if (old) old.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id   = "product-json-ld";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const el = document.getElementById("product-json-ld");
      if (el) el.remove();
    };
  }, [product.id, product.rating, product.reviewsCount, product.price, product.stockStatus]);

  // Sync state if settings modify in real-time
  useEffect(() => {
    if (selectedBrand && !Object.keys(BRAND_MODELS).includes(selectedBrand)) {
      setSelectedBrand("");
      setSelectedModel("");
    } else if (selectedBrand && selectedModel) {
      const currentModels = BRAND_MODELS[selectedBrand] || [];
      if (!currentModels.includes(selectedModel)) {
        setSelectedModel("");
      }
    }
  }, [settings, BRAND_MODELS, selectedBrand, selectedModel]);

  // Change brand updates current model lists
  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel("");
    setSelectionError(null);
  };

  const verifySelection = () => {
    if (!selectedBrand || !selectedBrand.trim()) {
      setSelectionError("PLEASE SELECT YOUR MOBILE BRAND FIRST!");
      return false;
    }
    if (!selectedModel || !selectedModel.trim()) {
      setSelectionError("PLEASE SELECT YOUR EXACT PHONE MODEL!");
      return false;
    }
    if (requiresCustomerImage && !customerImage) {
      setSelectionError("PLEASE UPLOAD YOUR PHOTO FOR THIS CASE!");
      return false;
    }
    if (requiresCustomText && !customText.trim()) {
      setSelectionError("PLEASE ENTER THE NAME TO PRINT ON YOUR CASE!");
      return false;
    }
    setSelectionError(null);
    return true;
  };

  const handleAddClick = () => {
    if (!verifySelection()) return;
    onAddToCart({
      product,
      quantity,
      selectedModel: `${selectedBrand.replace(" Cases", "")} - ${selectedModel}`,
      customText: requiresCustomText ? customText : undefined,
      customerImage: requiresCustomerImage ? (customerImage ?? undefined) : undefined,
    });
    setCartSuccess(true);
    setTimeout(() => setCartSuccess(false), 3000);
  };

  const handleBuyNowClick = () => {
    if (!verifySelection()) return;
    onAddToCart({
      product,
      quantity,
      selectedModel: `${selectedBrand.replace(" Cases", "")} - ${selectedModel}`,
      customText: requiresCustomText ? customText : undefined,
      customerImage: requiresCustomerImage ? (customerImage ?? undefined) : undefined,
    });
  };

  // Seeded random from product.id — same product always gets same rating/count
  const _seed = product.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const _r1   = ((_seed * 9301 + 49297) % 233280) / 233280;
  const _r2   = ((_seed * 7919 + 12345) % 199999) / 199999;
  const ratingVal   = (product.rating    && product.rating    > 0)
    ? product.rating
    : parseFloat((4.2 + _r1 * 0.7).toFixed(1));
  const reviewCount = (product.reviewsCount && product.reviewsCount > 0)
    ? product.reviewsCount
    : Math.floor(200 + _r2 * 201);

  return (
    <div className="py-4 sm:py-10 bg-white font-sans min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Navigation Breadcrumb */}
        <div className="mb-3 select-none flex items-center justify-between">
          <button 
            onClick={onGoBack}
            className="text-xs font-bold text-zinc-600 hover:text-zinc-950 bg-transparent border border-zinc-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
          >
            Back
          </button>
          <button
            onClick={() => {
              const url = new URL(window.location.origin + window.location.pathname);
              url.searchParams.set("product", product.id);
              navigator.clipboard.writeText(url.toString());
              setShareCopied(true);
              setTimeout(() => setShareCopied(false), 2000);
            }}
            className={"text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-2 border " + (shareCopied ? "bg-emerald-500 text-white border-emerald-500" : "text-[#000000] hover:text-white hover:bg-[#000000] bg-transparent border-[#000000]")}
          >
            <Share2 className="w-3.5 h-3.5" />
            {shareCopied ? "Copied!" : "Share"}
          </button>
        </div>

        {/* Master details section split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          
          {/* Exact product image display centered (Left Panel - 6 Cols) */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="sticky top-28 w-full space-y-6">
              <div 
                className="bg-zinc-100/40 rounded-2xl p-4 w-full flex items-center justify-center relative overflow-hidden" 
                style={{aspectRatio: "3/4", maxHeight: "520px"}}
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                onTouchMove={e => { touchEndX.current = e.touches[0].clientX; }}
                onTouchEnd={handleSwipe}
              >
                
                {/* Cross-fade image display — previous image stays until new one is ready */}
                {(() => {
                  const activeUrl = product.images[activeImgIdx] || "/placeholder.png";
                  const isCloud = activeUrl.includes("res.cloudinary.com");
                  const srcSet = cdnSrcSet(activeUrl);
                  return (
                    <>
                      {/* Skeleton — only on very first load when nothing to show yet */}
                      {!mainImgLoaded && activeImgIdx === 0 && (
                        <div className="absolute inset-0 bg-zinc-100 animate-pulse rounded-xl" />
                      )}
                      <img
                        key={activeUrl}
                        src={cdnImg(activeUrl, 600)}
                        srcSet={srcSet || undefined}
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        alt={`${product.title} – Buy Online India | FabCoverz`}
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        onLoad={() => setMainImgLoaded(true)}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none rounded-xl animate-fadeIn"
                        referrerPolicy="no-referrer"
                        style={{ animationDuration: "300ms" }}
                      />
                    </>
                  );
                })()}

                {/* Dot indicators — mobile only, only when multiple images */}
                {product.images && product.images.length > 1 && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 lg:hidden">
                    {product.images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImgIdx(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === activeImgIdx ? "bg-zinc-900 scale-125" : "bg-zinc-400/60"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Dynamic Name Custom Lettering inside Product Details if it's name cases */}
                {productCollIds.includes("name-cases") && customText && (
                  <div className="absolute bottom-12 left-0 right-0 px-6 py-2 flex justify-center z-20 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-xs px-5 py-2 rounded-xl border border-white/20">
                      <span 
                        className="font-sans italic text-lg md:text-xl tracking-widest text-center text-white font-black block"
                        style={{
                          textShadow: "2px 2px 5px rgba(0,0,0,0.95), 0 0 12px rgba(255,255,255,0.5)"
                        }}
                      >
                        {customText}
                      </span>
                    </div>
                  </div>
                )}


                
                {/* Tiny gloss layer spec indicator */}
                <div className="absolute top-6 right-6 z-10">
                  <span className="text-[9px] font-sans font-bold text-zinc-900 bg-zinc-200/80 backdrop-blur-xs px-2.5 py-1 rounded-lg uppercase">
                    Metal Glossy Case
                  </span>
                </div>
              </div>

              {/* Dynamic Images Gallery selector (1 to 3 images supported) */}
              {product.images && product.images.length > 1 && (
                <div className="flex justify-center gap-3 w-full select-none">
                  {product.images.map((img, idx) => {
                    const isActive = idx === activeImgIdx;
                    const isCustomUrl = img.startsWith("http") || img.includes(".") || img.includes("/");
                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveImgIdx(idx)}
                        className={`relative w-16 h-16 bg-zinc-100/40 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer transition-all hover:scale-105 ${
                          isActive 
                            ? "ring-2 ring-[#000000] opacity-100" 
                            : "opacity-70 hover:opacity-100"
                        }`}
                      >
                        {isCustomUrl ? (
                          <img 
                            src={cdnThumb(img)} 
                            alt={`${product.title} view ${idx + 1} – FabCoverz`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col justify-between p-1.5 bg-gradient-to-br from-zinc-100 to-zinc-50">
                            <span className="text-[6px] font-sans font-black text-zinc-400 uppercase tracking-widest block text-left truncate">
                              {img.replace("god-", "").replace("tvk-", "")}
                            </span>
                            <div className="mx-auto select-none opacity-80 scale-75">
                              <Smartphone className="w-4 h-4 text-zinc-500" />
                            </div>
                            <span className="text-[7px] font-sans text-zinc-500 font-extrabold block text-center uppercase">
                              Preset {idx + 1}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Checkout parameters & forms (Right Panel - 7 Cols) */}
          <div className="lg:col-span-6 space-y-8">
            
            {/* Title Block */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-block px-2 py-0.5 bg-zinc-900 text-white text-[9px] font-sans tracking-widest uppercase rounded-xs">
                  {(allCollections.find(c => c.slug === product.collectionId)?.name || product.collectionId).replace("-", " ")}
                </span>
                <span className="text-[10px] font-sans text-zinc-500 font-bold flex items-center gap-0.5">
                  ● {product.stockStatus === "in_stock" ? "In Stock" : "Limited Inventory Drop"}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-sans tracking-tight font-black italic text-zinc-900 leading-tight uppercase">
                {product.title}
              </h1>
              
              <div className="flex items-center gap-3">
                <div className="flex text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4.5 h-4.5 fill-current" />
                  ))}
                </div>
                <span className="text-xs font-sans text-zinc-400 font-bold">
                  {ratingVal.toFixed(1)} Rating ({reviewCount} verified customers)
                </span>
              </div>
            </div>

            {/* Price Line */}
            <div className="py-2.5 space-y-1 font-sans">
              <div className="flex items-baseline gap-3">
                {product.comparePrice && (
                  <span className="text-xl font-sans line-through text-zinc-400 font-medium italic">
                    ₹{product.comparePrice}
                  </span>
                )}
                <span className="text-4xl font-sans font-black italic text-zinc-900">
                  ₹{product.price}
                </span>
              </div>
              <p className="text-sm font-black italic text-zinc-600 tracking-wide uppercase">
                Shipping charges will be calculated at checkout
              </p>
            </div>

            {/* PHOTO UPLOAD — for photo-cases and photo-name-cases */}
            {requiresCustomerImage && (
              <div className="space-y-2 pt-4 border-t border-zinc-200">
                <label className="block text-[10px] font-sans tracking-wider font-extrabold text-zinc-500 uppercase mb-1.5">
                  Upload Your Photo <span className="text-red-500">*</span>
                </label>
                <label className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-all py-5 px-4 ${customerImage ? "border-emerald-400 bg-emerald-50" : "border-zinc-300 bg-zinc-50 hover:border-[#000000] hover:bg-gray-50"}`}>
                  {customerImage ? (
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-emerald-600">Photo Uploaded Successfully</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Tap to change photo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center">
                        <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <p className="text-xs font-black text-zinc-700">Click to upload your photo</p>
                      <p className="text-[10px] text-zinc-400">JPG, PNG up to 10MB</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
                </label>
                {imageUploadError && (
                  <p className="text-[10px] text-red-500 font-bold">{imageUploadError}</p>
                )}
              </div>
            )}

            {/* CUSTOM NAME INPUT — for name-cases and photo-name-cases */}
            {requiresCustomText && (
              <div className="space-y-2 pt-4 border-t border-zinc-200">
                <label className="block text-[10px] font-sans tracking-wider font-extrabold text-zinc-500 uppercase mb-1.5">
                  {isPhotoNameCase ? "Name to Print on Case" : "Your Custom Name"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  maxLength={20}
                  placeholder={isPhotoNameCase ? "Enter name (max 20 chars)" : "Type your name here..."}
                  className="w-full border border-zinc-250 rounded-xl px-4 py-3 text-sm font-sans font-bold text-zinc-900 outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] placeholder:font-normal placeholder:text-zinc-400 tracking-widest"
                />
                <p className="text-[10px] text-zinc-400">{customText.length}/20 characters</p>
              </div>
            )}

            {/* MODEL SELECTOR GRID (Two dropdowns starting as unselected) */}
            <div className="space-y-4 pt-4 border-t border-zinc-200">
              <div className="flex items-center gap-2 font-sans font-bold text-zinc-900">
                <Smartphone className="w-5 h-5 text-zinc-850" />
                <span className="text-xs tracking-wider uppercase font-black text-zinc-800">Select Brand & Model</span>
              </div>

              <div className="space-y-4">
                {/* 1. Brand Selection Dropdown */}
                <div>
                  <label className="block text-[10px] font-sans tracking-wider font-extrabold text-zinc-500 uppercase mb-1.5">
                    Choose Mobile Brand:
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBrand}
                      onChange={(e) => handleBrandChange(e.target.value)}
                      className="w-full bg-white border border-zinc-250 rounded-xl px-4 py-3 text-xs font-sans font-bold text-zinc-900 outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] appearance-none cursor-pointer"
                    >
                      <option value="">-- SELECT YOUR PHONE BRAND --</option>
                      {Object.keys(BRAND_MODELS).map((brandName) => (
                        <option key={brandName} value={brandName}>
                          {brandName.replace(" Cases", "")}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                      ▼
                    </div>
                  </div>
                </div>

                {/* 2. Specific Model Dropdown */}
                <div>
                  <label className="block text-[10px] font-sans tracking-wider font-extrabold text-zinc-500 uppercase mb-1.5">
                    Choose Specific Model:
                  </label>
                  <div className="relative">
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        setSelectionError(null);
                      }}
                      disabled={!selectedBrand}
                      className="w-full bg-white border border-zinc-250 rounded-xl px-4 py-3 text-xs font-sans font-bold text-zinc-900 outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] appearance-none disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <option value="">
                        {selectedBrand ? "-- SELECT EXACT PHONE MODEL --" : "-- SELECT BRAND FIRST --"}
                      </option>
                      {selectedBrand && BRAND_MODELS[selectedBrand]?.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                      ▼
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ERROR ALERT BANNER */}
            {selectionError && (
              <div className="bg-red-50 text-red-650 border border-red-200 rounded-xl p-4 text-xs font-sans font-bold flex items-center gap-2.5 animate-pulse justify-center">
                <span>{selectionError}</span>
              </div>
            )}

            {/* Material & Feature details - placed after phone model selection */}
            <div className="space-y-3 text-sm text-zinc-600 leading-relaxed pt-2 border-t border-zinc-200">
              <p className="font-black text-zinc-900 text-xs tracking-wider uppercase">FabCoverz Premium Metal Glossy Phone Case</p>
              <p className="font-normal text-zinc-500 text-[13px] leading-relaxed">
                Experience a premium look and feel with FabCoverz Metal Glossy Phone Cases, crafted to deliver exceptional shine, durability, and style. High-definition printing technology ensures vibrant colors, sharp details, and long-lasting image quality that won't easily fade. The glossy metal finish enhances every design with a rich, premium appearance while providing reliable everyday protection. Precision-cut edges guarantee a perfect fit and easy access to all ports and buttons. Designed for customers who want both superior protection and professional-quality customization in one premium case.
              </p>
              <ul className="grid grid-cols-2 gap-2 text-xs font-bold text-zinc-500 mt-2">
                <li className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#000000] shrink-0" /> 10ft Corner Drop protective shield</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#000000] shrink-0" /> Raised camera lens lip guard</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#000000] shrink-0" /> Ultra scratch-proof gloss backing</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#000000] shrink-0" /> Non-yellowing TPU rubber borders</li>
              </ul>
            </div>

            {/* QUANTITY & ACTIONS */}
            <div className="space-y-4 pt-4 border-t border-zinc-200">
              <div className="space-y-4">
                
                {/* Custom input box */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-sans tracking-wider font-extrabold text-zinc-500 uppercase">Quantity:</span>
                  <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-3xs">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      type="button"
                      className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-750 font-sans font-bold cursor-pointer outline-none border-none border-r border-zinc-200"
                    >
                      -
                    </button>
                    <span className="px-5 py-2 font-sans text-xs font-black text-zinc-900 select-none">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      type="button"
                      className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-750 font-sans font-bold cursor-pointer outline-none border-none border-l border-zinc-200"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Main purchase triggers - Stacked vertical layout */}
                <div className="flex flex-col gap-2.5 w-full pt-1">
                  <button
                    onClick={handleAddClick}
                    disabled={product.stockStatus === "out_of_stock"}
                    className={`w-full py-4 px-5 rounded-xl text-[11px] font-sans tracking-widest uppercase font-black cursor-pointer select-none transition-all flex items-center justify-center gap-2 border-none ${
                      product.stockStatus === "out_of_stock"
                        ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                        : "bg-zinc-900 hover:bg-zinc-800 text-white active:scale-95 shadow-3xs"
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{product.stockStatus === "out_of_stock" ? "Out of Stock" : "Add to Cart"}</span>
                  </button>

                  <button
                    onClick={handleBuyNowClick}
                    disabled={product.stockStatus === "out_of_stock"}
                    className={`w-full py-4 px-5 rounded-xl text-[11px] font-sans tracking-widest uppercase font-black cursor-pointer select-none transition-all flex items-center justify-center gap-2 border-none ${
                      product.stockStatus === "out_of_stock"
                        ? "bg-zinc-150 text-zinc-350 cursor-not-allowed"
                        : "bg-[#007eff] text-white hover:bg-[#0066cc] active:scale-95 shadow-[0_4px_12px_rgba(0,126,255,0.35)]"
                    }`}
                  >

                    <span>Buy Now</span>
                  </button>
                </div>

              </div>

              {cartSuccess && (
                <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl p-3.5 text-xs font-sans font-bold flex items-center gap-2 animate-fade-in justify-center shadow-xs">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Item styled and added to your shopping cart! Slide drawer is floating.</span>
                </div>
              )}
            </div>

            {/* TRUST BULLETS */}
            <div className="grid grid-cols-2 gap-4 text-[11px] font-sans font-bold text-zinc-450 pt-4 pb-10 border-t border-zinc-205">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-zinc-700" />
                <span>PREMIUM QUALITY GUARANTEED</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4.5 h-4.5 text-zinc-700" />
                <span>{settings?.deliveryMessage || "FAST SHIPPING NATIONWIDE"}</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4.5 h-4.5 text-zinc-700" />
                <span>100% DEFECTS COVERED</span>
              </div>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4.5 h-4.5 text-zinc-700" />
                <span>SECURE TRANSIT TRACKING</span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ── RELATED PRODUCTS / TOP SELLING ── */}
      {(() => {
        // Photo case collections — show Top Selling scroll instead of same-collection related products
        const PHOTO_CASE_COLLECTIONS = ["photo-cases", "photo-name-cases"];
        const isPhotoCaseProduct = productCollIds.some(id => PHOTO_CASE_COLLECTIONS.includes(id));

        if (isPhotoCaseProduct) {
          // Get top selling products that are NOT from photo case collections
          const topSelling = allProducts
            .filter(p =>
              p.id !== product.id &&
              !(p.collectionIds?.length ? p.collectionIds : [p.collectionId]).some(id => PHOTO_CASE_COLLECTIONS.includes(id))
            )
            .sort((a, b) => {
              const scoreA = (a.isBestSeller ? 3 : 0) + (a.isTrending ? 2 : 0) + (a.isFeatured ? 1 : 0);
              const scoreB = (b.isBestSeller ? 3 : 0) + (b.isTrending ? 2 : 0) + (b.isFeatured ? 1 : 0);
              return scoreB - scoreA;
            })
            .slice(0, 20);

          if (topSelling.length === 0) return null;

          return (
            <div className="bg-white border-t border-zinc-100 mt-0">
              <TopSellingScroll
                products={topSelling}
                title="Top Selling Products"
                onSelectProduct={(p) => onSelectProduct?.(p)}
              />
            </div>
          );
        }

        // Default: related products grid for all other collections
        const parentCollection = allCollections.find(c => c.slug === product.collectionId);
        const productSubcollections = (parentCollection?.subcollections ?? []).filter(s =>
          s.productIds.includes(product.id)
        );

        const related = allProducts
          .filter(p => p.id !== product.id)
          .map(p => {
            let score = 0;
            const pCollIds = p.collectionIds?.length ? p.collectionIds : [p.collectionId];

            // Subcollection match (strongest signal)
            if (productSubcollections.length > 0) {
              const pSubcols = (parentCollection?.subcollections ?? []).filter(s =>
                s.productIds.includes(p.id)
              );
              const sharedSubcols = pSubcols.filter(s =>
                productSubcollections.some(ps => ps.id === s.id)
              ).length;
              score += sharedSubcols * 15;
            }

            // Shared collection — any overlap
            const sharedCols = pCollIds.filter(id => productCollIds.includes(id)).length;
            score += sharedCols * 10;

            const sharedTags = p.tags.filter(t => product.tags.includes(t)).length;
            score += sharedTags * 3;
            if (p.isFeatured) score += 1;
            if (p.isBestSeller) score += 1;
            if (p.isTrending) score += 1;
            return { product: p, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map(x => x.product);

        // "Also available in" — other collections beyond the primary
        const extraCollections = allCollections.filter(c =>
          productCollIds.includes(c.slug) && c.slug !== product.collectionId && c.isVisible !== false
        );

        if (related.length === 0 && extraCollections.length === 0) return null;

        return (
          <div className="bg-[#fafafa] border-t border-zinc-100 py-12 mt-0">
            <div className="max-w-7xl mx-auto px-6 lg:px-10">

              {/* Also available in — shown when product is in multiple collections */}
              {extraCollections.length > 0 && (
                <div className="mb-8 bg-white border border-zinc-200 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest shrink-0">Also available in:</span>
                  {extraCollections.map(c => (
                    <button
                      key={c.slug}
                      onClick={() => onSelectProduct && onSelectProduct(allProducts.find(p => (p.collectionIds?.length ? p.collectionIds : [p.collectionId]).includes(c.slug) && p.id !== product.id) || product)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f6ff] hover:bg-[#000000] text-[#000000] hover:text-white rounded-full text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer border border-[#000000]/20 hover:border-[#000000]"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              {related.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs font-black text-[#000000] uppercase tracking-widest mb-1">You May Also Like</p>
                      <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">Related Products</h2>
                    </div>
                    <span className="text-xs font-bold text-zinc-400">{related.length} products</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                    {related.map(p => (
                      <div
                        key={p.id}
                        onClick={() => onSelectProduct?.(p)}
                        className="bg-white border border-zinc-200 rounded-2xl overflow-hidden cursor-pointer hover:shadow-md hover:border-[#000000]/30 transition-all group"
                      >
                        <div className="aspect-[3/4] overflow-hidden bg-zinc-50 relative">
                          {p.images?.[0] ? (
                            <img
                              src={cdnThumb(p.images[0])}
                              alt={p.title}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">No Image</div>
                          )}
                          {p.comparePrice && p.comparePrice > p.price && (
                            <span className="absolute top-2 left-2 bg-zinc-900 text-white text-[9px] font-black px-2 py-0.5 rounded-full">SALE</span>
                          )}
                        </div>
                        <div className="p-3 text-center">
                          <p className="text-xs font-semibold text-zinc-800 line-clamp-2 leading-snug mb-1.5">{p.title}</p>
                          <div className="flex items-center justify-center gap-1.5">
                            {p.comparePrice && p.comparePrice > p.price && (
                              <span className="text-[10px] text-zinc-400 line-through">₹{p.comparePrice}</span>
                            )}
                            <span className="text-base font-black text-zinc-900">₹{p.price}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
