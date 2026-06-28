// ══════════════════════════════════════════════════════════════
//  useSEO.ts  —  FabCoverz Dynamic SEO Utility
//  Updates <title>, meta description, OG tags, canonical URL
//  and injects JSON-LD structured data per page.
// ══════════════════════════════════════════════════════════════

export interface SEOProps {
  title: string;
  description: string;
  url?: string;
  image?: string;
  type?: "website" | "product";
  price?: number;
  currency?: string;
  availability?: "InStock" | "OutOfStock";
  brand?: string;
  productName?: string;
  keywords?: string;
}

interface RuntimeSEOSettings {
  seoHomeTitle?: string;
  seoHomeDescription?: string;
  seoHomeKeywords?: string;
  seoCollectionOverrides?: Record<string, { title?: string; description?: string; keywords?: string }>;
}
let _runtimeSEO: RuntimeSEOSettings = {};

export function setSEOSettings(settings: RuntimeSEOSettings) {
  _runtimeSEO = settings;
}

const SITE_NAME     = "FabCoverz";
const BASE_URL      = "https://www.fabcoverz.store";
const DEFAULT_IMAGE = `${BASE_URL}/assets/banner/desktop_banner.png`;
const BASE_KEYWORDS =
  "fabcoverz, phone case India, mobile cover online India, buy phone case free shipping India, online payment phone case India, fabcoverz.store, fabcoverz.in";

function setMeta(selector: string, attr: string, value: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    const match = selector.match(/\[(\w+)="([^"]+)"\]/);
    if (match) el.setAttribute(match[1], match[2]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setCanonical(url: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

function setJsonLD(data: object) {
  const old = document.getElementById("dynamic-json-ld");
  if (old) old.remove();
  const script = document.createElement("script");
  script.type  = "application/ld+json";
  script.id    = "dynamic-json-ld";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export function applySEO(props: SEOProps) {
  const {
    title,
    description,
    url          = BASE_URL,
    image        = DEFAULT_IMAGE,
    type         = "website",
    price,
    currency     = "INR",
    availability = "InStock",
    brand        = "FabCoverz",
    productName,
    keywords,
  } = props;

  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;

  document.title = fullTitle;

  setMeta('meta[name="description"]',     "content", description);
  setMeta('meta[name="robots"]',          "content", "index, follow, max-snippet:-1, max-image-preview:large");
  setMeta('meta[name="keywords"]',        "content", keywords
    ? `${keywords}, ${BASE_KEYWORDS}`
    : BASE_KEYWORDS);

  setMeta('meta[property="og:title"]',       "content", fullTitle);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[property="og:url"]',         "content", url);
  setMeta('meta[property="og:image"]',       "content", image);
  setMeta('meta[property="og:image:width"]',  "content", "1200");
  setMeta('meta[property="og:image:height"]', "content", "432");
  setMeta('meta[property="og:image:alt"]',   "content", `${fullTitle} – FabCoverz`);
  setMeta('meta[property="og:type"]',        "content", type === "product" ? "product" : "website");
  setMeta('meta[property="og:site_name"]',   "content", SITE_NAME);
  setMeta('meta[property="og:locale"]',      "content", "en_IN");

  setMeta('meta[name="twitter:card"]',        "content", "summary_large_image");
  setMeta('meta[name="twitter:title"]',       "content", fullTitle);
  setMeta('meta[name="twitter:description"]', "content", description);
  setMeta('meta[name="twitter:image"]',       "content", image);

  setCanonical(url);

  if (type === "product" && productName && price !== undefined) {
    setJsonLD({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": productName,
      "image": image,
      "description": description,
      "brand": { "@type": "Brand", "name": brand },
      "offers": {
        "@type": "Offer",
        "price": price,
        "priceCurrency": currency,
        "availability": `https://schema.org/${availability}`,
        "url": url,
        "priceValidUntil": "2026-12-31",
        "itemCondition": "https://schema.org/NewCondition",
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "IN",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": 7,
          "returnMethod": "https://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/FreeReturn"
        },
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "value": "0",
            "currency": "INR"
          },
          "shippingDestination": {
            "@type": "DefinedRegion",
            "addressCountry": "IN"
          },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": {
              "@type": "QuantitativeValue",
              "minValue": 0,
              "maxValue": 1,
              "unitCode": "DAY"
            },
            "transitTime": {
              "@type": "QuantitativeValue",
              "minValue": 3,
              "maxValue": 7,
              "unitCode": "DAY"
            }
          }
        },
        "seller": {
          "@type": "Organization",
          "name": "FabCoverz",
          "url": BASE_URL
        },
      },
    });
  } else {
    const old = document.getElementById("dynamic-json-ld");
    if (old) old.remove();
  }
}

// ── Preset helpers ────────────────────────────────────────────

export function seoHome() {
  applySEO({
    title:
      _runtimeSEO.seoHomeTitle ||
      "FabCoverz – Custom Phone Cases India | Murugan, TVK",
    description:
      _runtimeSEO.seoHomeDescription ||
      "Buy custom phone cases in India — Murugan, TVK, photo print & metal glossy covers for iPhone & Samsung. Secure online payment. Free shipping above ₹499.",
    url: `${BASE_URL}/`,
    keywords:
      _runtimeSEO.seoHomeKeywords ||
      "phone case India, buy phone case online India, best phone case India, murugan phone case, TVK vijay case, customized mobile cover, photo print case, metal glossy case, online payment phone case India, free shipping phone case India, fabcoverz, Tamil Nadu phone case, god phone case India",
  });
}

export function seoCollections() {
  applySEO({
    title: "All Phone Case Collections – Free Shipping | FabCoverz India",
    description:
      "Browse all FabCoverz collections — Murugan cases, TVK cases, metal glossy covers, photo print cases, name cases, designer covers and more. Secure online payment + free shipping across India.",
    url: `${BASE_URL}/collections`,
    keywords:
      "phone case collections India, all mobile covers, god cases, TVK cases, metal cases, photo cases, online payment mobile cover India, free shipping phone case India",
  });
}

// Per-collection keyword map for stronger targeting
const COLLECTION_SEO: Record<string, { title: string; description: string; keywords: string }> = {
  "god-cases": {
    title: "Murugan & God Phone Cases – Buy Online India | Free Shipping | FabCoverz",
    description:
      "Buy Murugan, Ganesha, Shiva, Hanuman and devotional god phone cases online in India. Premium metal glossy finish. Secure online payment. Free shipping. Best Hindu god mobile covers at FabCoverz.",
    keywords:
      "murugan phone case India, murugan mobile cover, god phone case India, devotional phone case, ganesha phone case, shiva mobile cover, hanuman case, buy murugan case online India free shipping",
  },
  "tvk-cases": {
    title: "TVK Vijay Phone Cases – Buy TVK Mobile Cover Online | Free Shipping | FabCoverz",
    description:
      "Shop TVK Vijay party phone cases at FabCoverz. Premium glossy TVK mobile covers with secure online payment and free shipping across India. Show your support with the best TVK cases.",
    keywords:
      "TVK phone case, TVK mobile cover, vijay case, thalapathy phone case, TVK glossy case India, buy TVK case online India free shipping",
  },
  "metal-cases": {
    title: "Metal Glossy Phone Cases – Buy Online India | Free Shipping | FabCoverz",
    description:
      "Buy premium metal glossy phone cases online at FabCoverz. High-definition prints, scratch-resistant. Compatible with iPhone, Samsung, OnePlus. Secure online payment + free shipping across India.",
    keywords:
      "metal glossy phone case India, metal mobile cover, premium phone case, scratch resistant case, buy metal glossy case online India free shipping",
  },
  "photo-cases": {
    title: "Photo Print Phone Cases – Custom Photo Mobile Cover | Free Shipping | FabCoverz",
    description:
      "Turn your favourite photo into a custom phone case at FabCoverz. High-quality photo print mobile covers with vibrant colors. Secure online payment. Free shipping across India.",
    keywords:
      "photo print phone case India, custom photo mobile cover, personalised case, print photo on phone case, custom phone case India free shipping",
  },
  "name-cases": {
    title: "Custom Name Phone Cases – Name Mobile Cover Online | Free Shipping | FabCoverz",
    description:
      "Buy custom name phone cases online at FabCoverz. Personalised name mobile covers for iPhone and Samsung. Premium quality. Secure online payment. Free shipping across India.",
    keywords:
      "name phone case India, custom name mobile cover, personalised name case, buy name case online India free shipping",
  },
  "photo-name-cases": {
    title: "Photo & Name Custom Phone Cases – Free Shipping | FabCoverz India",
    description:
      "Personalised photo and name phone cases at FabCoverz. Premium custom covers with your photo and name. Best gift idea. Secure online payment + free shipping across India.",
    keywords:
      "photo name phone case India, custom photo name cover, personalised mobile cover India, free shipping gift phone case",
  },
  "trendy-cases": {
    title: "Trending Phone Cases – Latest Designer Mobile Covers | Free Shipping | FabCoverz",
    description:
      "Shop trending and latest designer phone cases at FabCoverz. Stylish glossy mobile covers for iPhone and Samsung. New arrivals. Secure online payment + free shipping across India.",
    keywords:
      "trending phone case India, latest mobile cover, stylish phone case, designer case online India free shipping",
  },
  "girly-cases": {
    title: "Girly & Cute Phone Cases – Pink Designer Mobile Covers | Free Shipping | FabCoverz",
    description:
      "Shop cute girly phone cases at FabCoverz. Pink, love-themed, aesthetic mobile covers for girls. Premium glossy finish. Secure online payment + free shipping across India.",
    keywords:
      "girly phone case India, cute mobile cover, pink phone case, aesthetic case for girls, free shipping girly case India",
  },
};

export function seoCollectionDetail(slug: string, name: string, image?: string) {
  const adminOverride = _runtimeSEO.seoCollectionOverrides?.[slug];
  const hardcoded = COLLECTION_SEO[slug];

  if (adminOverride && (adminOverride.title || adminOverride.description)) {
    applySEO({
      title: adminOverride.title || hardcoded?.title || `${name} – Buy Online Free Shipping | FabCoverz`,
      description: adminOverride.description || hardcoded?.description || `Shop the best ${name} phone cases in India. Secure online payment + free shipping on all orders.`,
      url: `${BASE_URL}/collections/${slug}`,
      image: image || DEFAULT_IMAGE,
      keywords: adminOverride.keywords || hardcoded?.keywords || `${name} phone case India, free shipping`,
    });
  } else if (hardcoded) {
    applySEO({
      title: hardcoded.title,
      description: hardcoded.description,
      url: `${BASE_URL}/collections/${slug}`,
      image: image || DEFAULT_IMAGE,
      keywords: hardcoded.keywords,
    });
  } else {
    const slugReadable = name || slug.replace(/-/g, " ");
    applySEO({
      title: `${slugReadable} – Buy Online India | Free Shipping | FabCoverz`,
      description: `Shop the best ${slugReadable} phone cases in India. Premium quality, vibrant prints, secure online payment, free shipping. Compatible with iPhone, Samsung and more – FabCoverz.`,
      url: `${BASE_URL}/collections/${slug}`,
      image: image || DEFAULT_IMAGE,
      keywords: `${slugReadable} phone case India, buy ${slugReadable} online free shipping fabcoverz`,
    });
  }
}

export function seoProduct(
  productId: string,
  title: string,
  description: string,
  price: number,
  image?: string,
  availability: "InStock" | "OutOfStock" = "InStock"
) {
  const lowerTitle = title.toLowerCase();
  let extraKeywords = "buy phone case India free shipping, mobile cover online fabcoverz";
  if (lowerTitle.includes("murugan"))
    extraKeywords = "murugan phone case India, murugan mobile cover free shipping, buy murugan case online fabcoverz";
  else if (lowerTitle.includes("tvk") || lowerTitle.includes("vijay"))
    extraKeywords = "TVK phone case, TVK mobile cover, buy TVK case India free shipping fabcoverz";
  else if (lowerTitle.includes("metal") || lowerTitle.includes("glossy"))
    extraKeywords = "metal glossy phone case India, premium mobile cover free shipping, fabcoverz";
  else if (lowerTitle.includes("photo"))
    extraKeywords = "photo print phone case India, custom photo mobile cover free shipping, fabcoverz";
  else if (lowerTitle.includes("name"))
    extraKeywords = "name phone case India, custom name mobile cover free shipping, fabcoverz";
  else if (
    lowerTitle.includes("ganesha") ||
    lowerTitle.includes("shiva")    ||
    lowerTitle.includes("hanuman")  ||
    lowerTitle.includes("durga")    ||
    lowerTitle.includes("krishna")
  )
    extraKeywords = "god phone case India, devotional mobile cover free shipping, fabcoverz";

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  applySEO({
    title: `${title} – Buy Online India | Free Shipping | FabCoverz`,
    description:
      description ||
      `Buy ${title} online in India at FabCoverz. Premium quality phone case, secure online payment, free shipping. Best price guaranteed.`,
    url: `${BASE_URL}/products/${slug}--${productId}`,
    image: image || DEFAULT_IMAGE,
    type: "product",
    price,
    availability,
    productName: title,
    keywords: extraKeywords,
  });
}

export function seoPolicy(page: string) {
  const map: Record<string, string> = {
    privacy:  "Privacy Policy | FabCoverz",
    shipping: "Shipping Policy – Free Shipping Across India | FabCoverz",
    terms:    "Terms & Conditions | FabCoverz",
    refund:   "Refund & Return Policy | FabCoverz",
  };
  applySEO({
    title: map[page] || "Policy | FabCoverz",
    description: "FabCoverz store policies — free shipping, payments, returns, privacy and terms.",
    url: `${BASE_URL}/policy/${page}`,
  });
}

export function seoTrackOrder() {
  applySEO({
    title: "Track Your Order | FabCoverz",
    description: "Track your FabCoverz phone case order in real time. Enter your AWB number to see live shipment status.",
    url: `${BASE_URL}/track-order`,
  });
}
