// ══════════════════════════════════════════════════════════════
//  generateMerchantFeed.ts — Google Merchant Center XML Feed
//  Call this from AdminPanel to download a product feed XML.
//  Submit to https://merchants.google.com → Products → Feeds
// ══════════════════════════════════════════════════════════════

import { Product } from "../types";

const STORE_URL        = "https://www.fabcoverz.store";
const BRAND            = "FabCoverz";
const CURRENCY         = "INR";
const CONDITION        = "new";
const SHIPPING_COUNTRY = "IN";
// Free shipping on all orders — no COD
const SHIPPING_PRICE   = "0";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Convert product title → clean URL slug (must match App.tsx routing) */
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Build a proper Cloudinary URL from whatever is stored in images[].
 */
function buildImageUrl(raw: string): string {
  if (!raw) return `${STORE_URL}/assets/logo/round_logo.png`;
  if (raw.startsWith("http")) {
    if (raw.includes("res.cloudinary.com")) {
      return raw.replace("/upload/", "/upload/w_800,h_800,c_pad,f_jpg,q_auto/");
    }
    return raw;
  }
  return `https://res.cloudinary.com/dq9qcnbvd/image/upload/w_800,h_800,c_pad,f_jpg,q_auto/${raw}.jpg`;
}

/** Build unique slugs — same-title products get -2, -3 suffix */
function buildUniqueSlugMap(products: Product[]): Map<string, string> {
  const slugCount: Record<string, number> = {};
  const map = new Map<string, string>();
  for (const p of products) {
    const base = toSlug(p.title);
    slugCount[base] = (slugCount[base] || 0) + 1;
    const count = slugCount[base];
    map.set(p.id, count === 1 ? base : `${base}-${count}`);
  }
  return map;
}

/**
 * Build SEO-rich title for the product feed.
 * Google rewards descriptive titles with key info up front.
 */
function buildFeedTitle(title: string): string {
  const lower = title.toLowerCase();
  // If already has "phone case" or "mobile cover" in title, just append brand
  if (lower.includes("case") || lower.includes("cover")) {
    return `${title} – FabCoverz India`;
  }
  return `${title} Phone Case – Buy Online India | FabCoverz`;
}

/**
 * Build a rich description for the feed.
 * Google uses this for relevance — include shipping signal and key features.
 */
function buildFeedDescription(p: Product): string {
  const base =
    p.description ||
    `Buy ${p.title} online in India at FabCoverz. Premium metal glossy phone case with vibrant print and fast delivery across India.`;

  // Append free shipping signal if not already present
  const shippingNote = "Free shipping across India. No COD — prepaid orders only.";
  const combined = base.length > 450
    ? base.slice(0, 450) + "... " + shippingNote
    : `${base} ${shippingNote}`;

  return combined.slice(0, 500);
}

export function generateMerchantFeedXML(products: Product[]): string {
  const active = products.filter((p) => p.stockStatus !== "out_of_stock");

  if (active.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>FabCoverz Product Feed</title>
    <link>${STORE_URL}</link>
    <description>FabCoverz — Custom Phone Cases India | Free Shipping</description>
  </channel>
</rss>`;
  }

  const uniqueSlugs = buildUniqueSlugMap(active);

  const items = active
    .map((p) => {
      const slug = uniqueSlugs.get(p.id) || toSlug(p.title);

      // URL format: /products/<slug>--<id>  (matches App.tsx product routing)
      const productUrl = `${STORE_URL}/products/${slug}--${encodeURIComponent(p.id)}`;

      const imageUrl = buildImageUrl(p.images?.[0] || "");

      // Up to 4 additional images
      const additionalImages = (p.images || [])
        .slice(1, 5)
        .map(
          (img) =>
            `      <g:additional_image_link>${escapeXml(buildImageUrl(img))}</g:additional_image_link>`
        )
        .join("\n");

      const price        = `${p.price ?? 299}.00 ${CURRENCY}`;
      const availability = p.stockStatus === "out_of_stock" ? "out of stock" : "in stock";
      const description  = escapeXml(buildFeedDescription(p));
      const feedTitle    = escapeXml(buildFeedTitle(p.title).slice(0, 150));
      const id           = escapeXml(p.id);

      return `    <item>
      <g:id>${id}</g:id>
      <g:title>${feedTitle}</g:title>
      <g:description>${description}</g:description>
      <g:link>${escapeXml(productUrl)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
${additionalImages ? additionalImages + "\n" : ""}      <g:condition>${CONDITION}</g:condition>
      <g:availability>${availability}</g:availability>
      <g:price>${price}</g:price>
      <g:sale_price_effective_date></g:sale_price_effective_date>
      <g:brand>${BRAND}</g:brand>
      <g:google_product_category>2906</g:google_product_category>
      <g:product_type>Mobile Phone Cases &gt; Custom Printed Cases</g:product_type>
      <g:shipping>
        <g:country>${SHIPPING_COUNTRY}</g:country>
        <g:price>${SHIPPING_PRICE} ${CURRENCY}</g:price>
        <g:min_handling_time>0</g:min_handling_time>
        <g:max_handling_time>1</g:max_handling_time>
        <g:min_transit_time>3</g:min_transit_time>
        <g:max_transit_time>7</g:max_transit_time>
      </g:shipping>
      <g:identifier_exists>no</g:identifier_exists>
      <g:is_bundle>no</g:is_bundle>
      <g:adult>no</g:adult>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>FabCoverz Product Feed</title>
    <link>${STORE_URL}</link>
    <description>FabCoverz — Custom Phone Cases India | Free Shipping</description>
${items}
  </channel>
</rss>`;
}

export function downloadMerchantFeed(products: Product[]): void {
  const xml  = generateMerchantFeedXML(products);
  const blob = new Blob([xml], { type: "application/xml" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `fabcoverz-merchant-feed-${new Date().toISOString().split("T")[0]}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}
