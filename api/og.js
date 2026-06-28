/**
 * /api/og.js — Vercel Serverless Function
 *
 * Called by middleware.js when a bot/crawler hits a product or collection URL.
 * Fetches data from Supabase and returns a fully-formed HTML page with:
 *   - OG meta tags (title, image, description, price)
 *   - JSON-LD Product schema (for Google Shopping rich results)
 *   - Proper canonical URL pointing to the clean /products/ URL
 *
 * Supported query params (set by middleware):
 *   /api/og?type=product&id=<productId>
 *   /api/og?type=collection&slug=<collectionSlug>
 */

const SUPABASE_URL = "https://rrirrmjfdocqtfifzuiz.supabase.co";
const SUPABASE_KEY = "sb_publishable_kUcYS_2OibJNFgfkYdWOXw_K67rH8Zh";
const BASE_URL     = "https://www.fabcoverz.store";
const FALLBACK_IMG = `${BASE_URL}/assets/logo/round_logo.png`;

/** Build a clean Cloudinary OG image (1200×630) */
function ogImg(raw) {
  if (!raw) return FALLBACK_IMG;
  if (raw.startsWith("http") && raw.includes("res.cloudinary.com")) {
    return raw.replace("/upload/", "/upload/f_jpg,q_auto:good,w_1200,h_630,c_fill,g_auto/");
  }
  if (raw.startsWith("http")) return raw;
  // public_id
  return `https://res.cloudinary.com/dq9qcnbvd/image/upload/f_jpg,q_auto:good,w_1200,h_630,c_fill,g_auto/${raw}.jpg`;
}

/** Convert title → URL slug */
function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function buildProductHtml({ id, title, description, image, url, price }) {
  const safeTitle = title.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const safeDesc  = description.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const safeImg   = ogImg(image);
  const priceNum  = parseFloat(price) || 299;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": title,
    "image": safeImg,
    "description": description,
    "brand": { "@type": "Brand", "name": "FabCoverz" },
    "offers": {
      "@type": "Offer",
      "price": priceNum,
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": url,
      "seller": { "@type": "Organization", "name": "FabCoverz" },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": { "@type": "MonetaryAmount", "value": "0", "currency": "INR" },
        "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "IN" }
      }
    }
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle} | FabCoverz</title>
  <meta name="description" content="${safeDesc}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />

  <!-- Open Graph -->
  <meta property="og:type"         content="product" />
  <meta property="og:site_name"    content="FabCoverz" />
  <meta property="og:title"        content="${safeTitle} | FabCoverz" />
  <meta property="og:description"  content="${safeDesc}" />
  <meta property="og:image"        content="${safeImg}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url"          content="${url}" />
  <meta property="og:locale"       content="en_IN" />
  <meta property="product:price:amount"   content="${priceNum}" />
  <meta property="product:price:currency" content="INR" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${safeTitle} | FabCoverz" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image"       content="${safeImg}" />

  <!-- JSON-LD Product Schema for Google Shopping -->
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>${safeDesc}</p>
  <p>Price: ₹${priceNum}</p>
  <p><a href="${url}">Buy ${safeTitle} at FabCoverz</a></p>
</body>
</html>`;
}

function buildCollectionHtml({ title, description, image, url }) {
  const safeTitle = title.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const safeDesc  = description.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const safeImg   = ogImg(image);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle} | FabCoverz</title>
  <meta name="description" content="${safeDesc}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type"         content="website" />
  <meta property="og:site_name"    content="FabCoverz" />
  <meta property="og:title"        content="${safeTitle} | FabCoverz" />
  <meta property="og:description"  content="${safeDesc}" />
  <meta property="og:image"        content="${safeImg}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url"          content="${url}" />
  <meta property="og:locale"       content="en_IN" />

  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${safeTitle} | FabCoverz" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image"       content="${safeImg}" />
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>${safeDesc}</p>
  <p><a href="${url}">Shop ${safeTitle} at FabCoverz</a></p>
</body>
</html>`;
}

export default async function handler(req, res) {
  const { type, id, slug } = req.query;

  try {
    if (type === "product" && id) {
      const row = await sbFetch(
        `products?id=eq.${encodeURIComponent(id)}&select=id,title,description,price,images,stock_status`
      );

      if (!row) {
        res.setHeader("Cache-Control", "s-maxage=60");
        res.status(404).send("Product not found");
        return;
      }

      let images = row.images || [];
      if (typeof images === "string") {
        try { images = JSON.parse(images); } catch { images = []; }
      }
      const image = images[0] || FALLBACK_IMG;
      const priceNum = row.price || 299;
      const description = row.description
        ? row.description.slice(0, 200)
        : `Buy ${row.title} online in India. Premium quality phone case from FabCoverz. Price: ₹${priceNum}. Free shipping available.`;

      // Build canonical clean URL
      const productSlug = toSlug(row.title);
      const canonicalUrl = `${BASE_URL}/products/${productSlug}--${row.id}`;

      const html = buildProductHtml({
        id: row.id,
        title: row.title,
        description,
        image,
        url: canonicalUrl,
        price: priceNum,
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      res.status(200).send(html);
      return;
    }

    if (type === "collection" && slug) {
      const row = await sbFetch(
        `collections?slug=eq.${encodeURIComponent(slug)}&select=id,name,image,slug`
      );

      if (!row) {
        res.setHeader("Cache-Control", "s-maxage=60");
        res.status(404).send("Collection not found");
        return;
      }

      const image = row.image && row.image.startsWith("http") ? row.image : FALLBACK_IMG;
      const description = `Shop ${row.name} collection at FabCoverz. Premium quality phone cases for all models. Free shipping across India.`;

      const html = buildCollectionHtml({
        title: row.name,
        description,
        image,
        url: `${BASE_URL}/collections/${slug}`,
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      res.status(200).send(html);
      return;
    }

    // Fallback
    res.setHeader("Location", BASE_URL);
    res.status(302).end();
  } catch (err) {
    console.error("OG handler error:", err);
    res.setHeader("Location", BASE_URL);
    res.status(302).end();
  }
}
