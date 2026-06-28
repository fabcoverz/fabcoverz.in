/**
 * remoteStore.ts — Supabase-backed data layer.
 * Exports the same function signatures as the old localStore.ts
 * so every existing import works without change.
 *
 * Tables in Supabase (see supabase_schema.sql):
 *   products, collections, banners, store_settings, faqs, reviews, orders
 */

import {
  Product, Collection, Banner, StoreSettings, FAQItem, ReviewItem, Order,
} from "../types";
import { sbGetAll, sbGetOne, sbUpsert, sbUpsertMany, sbUpdate, sbDelete } from "./supabase";
import { cacheFirst, cacheSet, cacheBust } from "./dataCache";
import {
  seedProducts, seedCollections, seedBanners, seedSettings, seedFAQs, seedReviews,
} from "./dbSeeder";

const SUPABASE_URL = "https://rrirrmjfdocqtfifzuiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyaXJybWpmZG9jcXRmaWZ6dWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTM5ODYsImV4cCI6MjA5NTUyOTk4Nn0.HySXwvFYB-94rbv_9Udveq-nUZP9QQriUNvjoKTfa18";

// ── Init / Seed ────────────────────────────────────────────────────────────────

/**
 * Called once on app boot.
 * Checks if Supabase already has data; if not, seeds defaults.
 */
export async function initDB(): Promise<void> {
  try {
    const products = await sbGetAll<Product>("products");
    if (products.length > 0) return; // already seeded

    const now = new Date().toISOString();
    const seededProducts = seedProducts.map((p) => ({
      ...p, created_at: now, updated_at: now,
    }));

    await sbUpsertMany("products", seededProducts);
    await sbUpsertMany("collections", seedCollections);
    await sbUpsertMany("banners", seedBanners);
    await sbUpsertMany("faqs", seedFAQs);
    await sbUpsertMany("reviews", seedReviews);
    await sbUpsert("store_settings", { id: "main", ...seedSettings });
  } catch (err) {
    console.error("initDB error:", err);
  }
}

export async function resetDB(): Promise<void> {
  // For safety, resetDB in remote mode just re-seeds missing data
  await initDB();
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts(onFresh?: (p: Product[]) => void): Promise<Product[]> {
  return cacheFirst(
    "products",
    async () => {
      const rows = await sbGetAll<any>("products", "created_at.desc");
      return rows.map(dbRowToProduct);
    },
    onFresh
  );
}

export async function addProduct(
  product: Omit<Product, "createdAt" | "updatedAt">
): Promise<Product> {
  const now = new Date().toISOString();
  const row = productToDbRow({ ...product, createdAt: now, updatedAt: now } as Product);
  await sbUpsert("products", row);
  cacheBust("products");
  return { ...product, createdAt: now, updatedAt: now } as Product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const row = partialProductToDbRow(updates);
  row.updated_at = new Date().toISOString();
  await sbUpdate("products", id, row);
  cacheBust("products");
}

export async function deleteProduct(id: string): Promise<void> {
  await sbDelete("products", id);
  cacheBust("products");
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function getCollections(onFresh?: (c: Collection[]) => void): Promise<Collection[]> {
  return cacheFirst(
    "collections",
    () => sbGetAll<Collection>("collections"),
    onFresh
  );
}

export async function addCollection(collection: Collection): Promise<void> {
  await sbUpsert("collections", collection);
  cacheBust("collections");
}

export async function updateCollection(
  id: string,
  updates: Partial<Collection>
): Promise<void> {
  await sbUpdate("collections", id, updates);
  cacheBust("collections");
}

export async function deleteCollection(id: string): Promise<void> {
  await sbDelete("collections", id);
  cacheBust("collections");
}

// ── Banners ───────────────────────────────────────────────────────────────────

/** Convert camelCase Banner → snake_case DB row */
function bannerToDbRow(b: Banner) {
  return {
    id:               b.id,
    title:            b.title       ?? "",
    subtitle:         b.subtitle    ?? "",
    badge:            b.badge       ?? "",
    image_url:        b.imageUrl    ?? "",
    mobile_image_url: b.mobileImageUrl ?? "",
    link:             b.link        ?? "/collections/all",
    active:           b.active      ?? true,
    order:            b.order       ?? 0,
  };
}

/** Convert snake_case DB row → camelCase Banner */
function bannerFromDbRow(r: any): Banner {
  return {
    id:             r.id,
    title:          r.title            ?? "",
    subtitle:       r.subtitle         ?? "",
    badge:          r.badge            ?? "",
    imageUrl:       r.image_url        ?? "",
    mobileImageUrl: r.mobile_image_url ?? "",
    link:           r.link             ?? "/collections/all",
    active:         r.active           ?? true,
    order:          r.order            ?? 0,
  };
}

export async function getBanners(): Promise<Banner[]> {
  return cacheFirst("banners", async () => {
    const rows = await sbGetAll<any>("banners", "order.asc");
    return rows.map(bannerFromDbRow);
  });
}

export async function addBanner(banner: Banner): Promise<void> {
  await sbUpsert("banners", bannerToDbRow(banner));
  cacheBust("banners");
}

export async function updateBanner(id: string, updates: Partial<Banner>): Promise<void> {
  await sbUpdate("banners", id, bannerToDbRow({ ...updates, id } as Banner));
  cacheBust("banners");
}

export async function deleteBanner(id: string): Promise<void> {
  await sbDelete("banners", id);
  cacheBust("banners");
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<StoreSettings> {
  return cacheFirst("settings", async () => {
    const row = await sbGetOne<any>("store_settings", "main");
    if (!row) return { ...seedSettings };
    return dbRowToSettings(row);
  });
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  await sbUpsert("store_settings", settingsToDbRow(settings));
  cacheBust("settings");
}

// ── FAQs ──────────────────────────────────────────────────────────────────────

export async function getFAQs(): Promise<FAQItem[]> {
  return sbGetAll<FAQItem>("faqs");
}

export async function addFAQ(faq: FAQItem): Promise<void> {
  await sbUpsert("faqs", faq);
}

export async function updateFAQ(id: string, updates: Partial<FAQItem>): Promise<void> {
  await sbUpdate("faqs", id, updates);
}

export async function deleteFAQ(id: string): Promise<void> {
  await sbDelete("faqs", id);
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function getReviews(): Promise<ReviewItem[]> {
  return cacheFirst("reviews", () => sbGetAll<ReviewItem>("reviews"));
}

export async function addReview(review: ReviewItem): Promise<void> {
  await sbUpsert("reviews", review);
}

export async function updateReview(id: string, updates: Partial<ReviewItem>): Promise<void> {
  await sbUpdate("reviews", id, updates);
}

export async function deleteReview(id: string): Promise<void> {
  await sbDelete("reviews", id);
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function getOrders(): Promise<Order[]> {
  const rows = await sbGetAll<any>("orders", "created_at.desc");
  return rows.map(dbRowToOrder);
}

export async function addOrder(order: Order): Promise<void> {
  await sbUpsert("orders", orderToDbRow(order));
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<void> {
  // Convert camelCase Order fields to snake_case DB columns before patching
  const dbUpdates: Record<string, unknown> = {};
  if (updates.items !== undefined)             dbUpdates.items               = updates.items;
  if (updates.subtotal !== undefined)          dbUpdates.subtotal            = updates.subtotal;
  if (updates.shipping !== undefined)          dbUpdates.shipping            = updates.shipping;
  if (updates.total !== undefined)             dbUpdates.total               = updates.total;
  if (updates.customerName !== undefined)      dbUpdates.customer_name       = updates.customerName;
  if (updates.customerEmail !== undefined)     dbUpdates.customer_email      = updates.customerEmail;
  if (updates.customerPhone !== undefined)     dbUpdates.customer_phone      = updates.customerPhone;
  if (updates.customerAltPhone !== undefined)  dbUpdates.customer_alt_phone  = updates.customerAltPhone ?? null;
  if (updates.shippingAddress !== undefined)   dbUpdates.shipping_address    = updates.shippingAddress;
  if (updates.city !== undefined)              dbUpdates.city                = updates.city;
  if (updates.state !== undefined)             dbUpdates.state               = updates.state;
  if (updates.pincode !== undefined)           dbUpdates.pincode             = updates.pincode;
  if (updates.paymentMethod !== undefined)     dbUpdates.payment_method      = updates.paymentMethod;
  if (updates.status !== undefined)            dbUpdates.status              = updates.status;
  if (updates.awb !== undefined)               dbUpdates.awb                 = updates.awb ?? null;
  // Pass through any already-snake_case keys used by legacy callers
  for (const k of ["nimbus_order_id", "awb"] as const) {
    if ((updates as any)[k] !== undefined) dbUpdates[k] = (updates as any)[k];
  }
  await sbUpdate("orders", id, dbUpdates);
}

export async function deleteOrder(id: string): Promise<void> {
  await sbDelete("orders", id);
}

export async function deleteAllOrders(): Promise<void> {
  // Single DELETE request matching all rows (created_at is always set)
  const deleteUrl = `${SUPABASE_URL}/rest/v1/orders?created_at=not.is.null`;
  const res = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`deleteAllOrders failed: ${res.status} ${err}`);
  }
}

/**
 * Generate next FC order number using an atomic Supabase RPC counter.
 * Falls back to timestamp-based ID if the RPC is unavailable.
 */
export async function getNextOrderId(): Promise<string> {
  try {
    // Call a Supabase RPC that atomically increments and returns the next counter
    const url = `${SUPABASE_URL}/rest/v1/rpc/increment_order_counter`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const num: number = await res.json();
      return "FC" + String(num).padStart(4, "0");
    }
  } catch {}
  // Fallback: timestamp-based ID (guaranteed unique even without DB)
  const ts = Date.now().toString(36).toUpperCase();
  return "FC" + ts;
}

// -- DB <-> TS field mapping --
// Supabase uses snake_case; TypeScript types use camelCase.
// Products and Orders need mapping; others are flat enough to use as-is.

function dbRowToProduct(r: any): Product {
  const primaryId = r.collection_id ?? r.collectionId ?? "";
  // collectionIds: prefer DB array, fall back to [primaryId] for legacy rows
  const ids: string[] = Array.isArray(r.collection_ids) && r.collection_ids.length > 0
    ? r.collection_ids
    : primaryId ? [primaryId] : [];
  return {
    id: r.id,
    title: r.title,
    price: r.price,
    comparePrice: r.compare_price ?? r.comparePrice ?? 0,
    discount: r.discount ?? 0,
    description: r.description ?? "",
    collectionId: primaryId,
    collectionIds: ids,
    tags: r.tags ?? [],
    stockStatus: r.stock_status ?? r.stockStatus ?? "in_stock",
    isFeatured: r.is_featured ?? r.isFeatured ?? false,
    isTrending: r.is_trending ?? r.isTrending ?? false,
    isNewArrival: r.is_new_arrival ?? r.isNewArrival ?? false,
    isBestSeller: r.is_best_seller ?? r.isBestSeller ?? false,
    images: r.images ?? [],
    models: r.models ?? [],
    createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? r.updatedAt ?? new Date().toISOString(),
    reviewsCount: r.reviews_count ?? r.reviewsCount,
    rating: r.rating,
  };
}

function productToDbRow(p: Product): Record<string, unknown> {
  // Ensure collectionIds always includes the primary collectionId
  const ids = Array.isArray(p.collectionIds) && p.collectionIds.length > 0
    ? p.collectionIds
    : p.collectionId ? [p.collectionId] : [];
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    compare_price: p.comparePrice,
    discount: p.discount,
    description: p.description,
    collection_id: ids[0] ?? p.collectionId,   // primary = first in list
    collection_ids: ids,
    tags: p.tags,
    stock_status: p.stockStatus,
    is_featured: p.isFeatured,
    is_trending: p.isTrending,
    is_new_arrival: p.isNewArrival,
    is_best_seller: p.isBestSeller,
    images: p.images,
    models: p.models,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    reviews_count: p.reviewsCount,
    rating: p.rating,
  };
}

function partialProductToDbRow(p: Partial<Product>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.price !== undefined) row.price = p.price;
  if (p.comparePrice !== undefined) row.compare_price = p.comparePrice;
  if (p.discount !== undefined) row.discount = p.discount;
  if (p.description !== undefined) row.description = p.description;
  if (p.collectionId !== undefined) row.collection_id = p.collectionId;
  if (p.collectionIds !== undefined) {
    row.collection_ids = p.collectionIds;
    if (p.collectionIds.length > 0) row.collection_id = p.collectionIds[0];
  }
  if (p.tags !== undefined) row.tags = p.tags;
  if (p.stockStatus !== undefined) row.stock_status = p.stockStatus;
  if (p.isFeatured !== undefined) row.is_featured = p.isFeatured;
  if (p.isTrending !== undefined) row.is_trending = p.isTrending;
  if (p.isNewArrival !== undefined) row.is_new_arrival = p.isNewArrival;
  if (p.isBestSeller !== undefined) row.is_best_seller = p.isBestSeller;
  if (p.images !== undefined) row.images = p.images;
  if (p.models !== undefined) row.models = p.models;
  if (p.reviewsCount !== undefined) row.reviews_count = p.reviewsCount;
  if (p.rating !== undefined) row.rating = p.rating;
  return row;
}

function dbRowToOrder(r: any): Order {
  return {
    id: r.id,
    items: typeof r.items === "string" ? JSON.parse(r.items) : r.items ?? [],
    subtotal: r.subtotal ?? 0,
    shipping: r.shipping ?? 0,
    total: r.total ?? 0,
    customerName: r.customer_name ?? r.customerName ?? "",
    customerEmail: r.customer_email ?? r.customerEmail ?? "",
    customerPhone: r.customer_phone ?? r.customerPhone ?? "",
    customerAltPhone: r.customer_alt_phone ?? r.customerAltPhone ?? undefined,
    shippingAddress: r.shipping_address ?? r.shippingAddress ?? "",
    city: r.city ?? "",
    state: r.state ?? "",
    pincode: r.pincode ?? "",
    paymentMethod: r.payment_method ?? r.paymentMethod ?? "cod",
    status: r.status ?? "pending",
    awb: r.awb ?? undefined,
    createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
  };
}

function orderToDbRow(o: Order): Record<string, unknown> {
  return {
    id: o.id,
    items: o.items,
    subtotal: o.subtotal,
    shipping: o.shipping,
    total: o.total,
    customer_name: o.customerName,
    customer_email: o.customerEmail,
    customer_phone: o.customerPhone,
    customer_alt_phone: o.customerAltPhone ?? null,
    shipping_address: o.shippingAddress,
    city: o.city,
    state: o.state,
    pincode: o.pincode,
    payment_method: o.paymentMethod,
    status: o.status,
    awb: o.awb ?? null,
    created_at: o.createdAt,
  };
}

// ── Settings field mapping ─────────────────────────────────────────────────────

function dbRowToSettings(r: any): StoreSettings {
  return {
    announcements: r.announcements ?? [],
    freeShippingThreshold: r.free_shipping_threshold ?? 499,
    contactEmail: r.contact_email ?? "",
    contactPhone: r.contact_phone ?? "",
    contactAddress: r.contact_address ?? "",
    instagramUrl: r.instagram_url ?? "",
    facebookUrl: r.facebook_url ?? "",
    offerText: r.offer_text ?? "",
    logoUrl: r.logo_url ?? "",
    logoText: r.logo_text ?? "",
    logoSubtext: r.logo_subtext ?? "",
    brandModels: r.brand_models ?? {},
    reassuranceCard1Title: r.reassurance_card1_title ?? "",
    reassuranceCard1Body: r.reassurance_card1_body ?? "",
    reassuranceCard2Title: r.reassurance_card2_title ?? "",
    reassuranceCard2Body: r.reassurance_card2_body ?? "",
    reassuranceCard3Title: r.reassurance_card3_title ?? "",
    reassuranceCard3Body: r.reassurance_card3_body ?? "",
    aboutSectionTitle: r.about_section_title ?? "",
    aboutSectionSubtitle: r.about_section_subtitle ?? "",
    aboutSectionDesc1: r.about_section_desc1 ?? "",
    aboutSectionDesc2: r.about_section_desc2 ?? "",
    bannerStoryBadge: r.banner_story_badge ?? "",
    reviewsBadge: r.reviews_badge ?? "",
    reviewsTitle: r.reviews_title ?? "",
    reviewsSubtitle: r.reviews_subtitle ?? "",
    footerDisclaimer: r.footer_disclaimer ?? "",
    trendingSectionTitle: r.trending_section_title ?? "",
    trendingSectionSubtitle: r.trending_section_subtitle ?? "",
    bestsellerSectionBadge: r.bestseller_section_badge ?? "",
    bestsellerSectionTitle: r.bestseller_section_title ?? "",
    bestsellerSectionSubtitle: r.bestseller_section_subtitle ?? "",
    contactSectionBadge: r.contact_section_badge ?? "",
    contactSectionTitle: r.contact_section_title ?? "",
    contactSectionSubtitle: r.contact_section_subtitle ?? "",
    newsletterBadge: r.newsletter_badge ?? "",
    newsletterTitle: r.newsletter_title ?? "",
    newsletterSubtitle: r.newsletter_subtitle ?? "",
    newsletterDisclaimer: r.newsletter_disclaimer ?? "",
    topSellingTitle: r.top_selling_title ?? "",
    topSellingProductIds: r.top_selling_product_ids ?? [],
    collectionOrder: r.collection_order ?? [],
    productOrder: r.product_order ?? {},
    subcollectionProductOrder: r.subcollection_product_order ?? {},
    bestSellingMetalProductIds: r.best_selling_metal_product_ids ?? [],
    instagramSnaps: r.instagram_snaps ?? [],
    maintenanceMode: r.maintenance_mode ?? false,
    maintenanceMessage: r.maintenance_message ?? "We are updating our store. Back shortly!",
    currencySymbol: r.currency_symbol ?? "₹",
    taxRate: r.tax_rate ?? 0,
    storeTimezone: r.store_timezone ?? "Asia/Kolkata",
    codEnabled: r.cod_enabled ?? true,
    deliveryMessage: r.delivery_message ?? "",
    estimatedDeliveryDays: r.estimated_delivery_days ?? "",
    coupons: r.coupons ?? [],
    whatsappNumber: r.whatsapp_number ?? "",
    whatsappEnabled: r.whatsapp_enabled ?? false,
    twitterUrl: r.twitter_url ?? "",
    youtubeUrl: r.youtube_url ?? "",
    seoHomeTitle: r.seo_home_title ?? "",
    seoHomeDescription: r.seo_home_description ?? "",
    seoHomeKeywords: r.seo_home_keywords ?? "",
    seoCollectionOverrides: r.seo_collection_overrides ?? {},
  };
}

function settingsToDbRow(s: StoreSettings): Record<string, unknown> {
  return {
    id: "main",
    announcements: s.announcements ?? [],
    free_shipping_threshold: s.freeShippingThreshold ?? 499,
    contact_email: s.contactEmail ?? "",
    contact_phone: s.contactPhone ?? "",
    contact_address: s.contactAddress ?? "",
    instagram_url: s.instagramUrl ?? "",
    facebook_url: s.facebookUrl ?? "",
    offer_text: s.offerText ?? "",
    logo_url: s.logoUrl ?? "",
    logo_text: s.logoText ?? "",
    logo_subtext: s.logoSubtext ?? "",
    brand_models: s.brandModels ?? {},
    reassurance_card1_title: s.reassuranceCard1Title ?? "",
    reassurance_card1_body: s.reassuranceCard1Body ?? "",
    reassurance_card2_title: s.reassuranceCard2Title ?? "",
    reassurance_card2_body: s.reassuranceCard2Body ?? "",
    reassurance_card3_title: s.reassuranceCard3Title ?? "",
    reassurance_card3_body: s.reassuranceCard3Body ?? "",
    about_section_title: s.aboutSectionTitle ?? "",
    about_section_subtitle: s.aboutSectionSubtitle ?? "",
    about_section_desc1: s.aboutSectionDesc1 ?? "",
    about_section_desc2: s.aboutSectionDesc2 ?? "",
    banner_story_badge: s.bannerStoryBadge ?? "",
    reviews_badge: s.reviewsBadge ?? "",
    reviews_title: s.reviewsTitle ?? "",
    reviews_subtitle: s.reviewsSubtitle ?? "",
    footer_disclaimer: s.footerDisclaimer ?? "",
    trending_section_title: s.trendingSectionTitle ?? "",
    trending_section_subtitle: s.trendingSectionSubtitle ?? "",
    bestseller_section_badge: s.bestsellerSectionBadge ?? "",
    bestseller_section_title: s.bestsellerSectionTitle ?? "",
    bestseller_section_subtitle: s.bestsellerSectionSubtitle ?? "",
    contact_section_badge: s.contactSectionBadge ?? "",
    contact_section_title: s.contactSectionTitle ?? "",
    contact_section_subtitle: s.contactSectionSubtitle ?? "",
    newsletter_badge: s.newsletterBadge ?? "",
    newsletter_title: s.newsletterTitle ?? "",
    newsletter_subtitle: s.newsletterSubtitle ?? "",
    newsletter_disclaimer: s.newsletterDisclaimer ?? "",
    top_selling_title: s.topSellingTitle ?? "",
    top_selling_product_ids: s.topSellingProductIds ?? [],
    collection_order: s.collectionOrder ?? [],
    product_order: s.productOrder ?? {},
    subcollection_product_order: s.subcollectionProductOrder ?? {},
    best_selling_metal_product_ids: s.bestSellingMetalProductIds ?? [],
    instagram_snaps: s.instagramSnaps ?? [],
    maintenance_mode: s.maintenanceMode ?? false,
    maintenance_message: s.maintenanceMessage ?? "We are updating our store. Back shortly!",
    currency_symbol: s.currencySymbol ?? "₹",
    tax_rate: s.taxRate ?? 0,
    store_timezone: s.storeTimezone ?? "Asia/Kolkata",
    cod_enabled: s.codEnabled ?? true,
    delivery_message: s.deliveryMessage ?? "",
    estimated_delivery_days: s.estimatedDeliveryDays ?? "",
    coupons: s.coupons ?? [],
    whatsapp_number: s.whatsappNumber ?? "",
    whatsapp_enabled: s.whatsappEnabled ?? false,
    twitter_url: s.twitterUrl ?? "",
    youtube_url: s.youtubeUrl ?? "",
    seo_home_title: s.seoHomeTitle ?? "",
    seo_home_description: s.seoHomeDescription ?? "",
    seo_home_keywords: s.seoHomeKeywords ?? "",
    seo_collection_overrides: s.seoCollectionOverrides ?? {},
    updated_at: new Date().toISOString(),
  };
}
