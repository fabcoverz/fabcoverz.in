/**
 * localStore.ts — IndexedDB-based persistence (replaces localStorage).
 * Same exported function names as before, but now async-capable.
 * Images of any size store reliably — no 5MB quota limit.
 */

import { Product, Collection, Banner, StoreSettings, FAQItem, ReviewItem, Order } from "../types";
import { seedProducts, seedCollections, seedBanners, seedSettings, seedFAQs, seedReviews } from "./dbSeeder";

const DB_NAME = "fabcoverz_idb";
const DB_VERSION = 1;

const STORES = {
  products: "products",
  collections: "collections",
  banners: "banners",
  settings: "settings",
  faqs: "faqs",
  reviews: "reviews",
  orders: "orders",
  meta: "meta",
};

// ── IDB helpers ───────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      Object.values(STORES).forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      });
      // meta store uses plain string keys (no keyPath)
      // already created above as { keyPath: "id" }, we'll just use id field
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function txGet<T>(storeName: string): Promise<T[]> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      })
  );
}

function txGetOne<T>(storeName: string, id: string): Promise<T | null> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(id);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      })
  );
}

function txPut<T extends { id: string }>(storeName: string, item: T): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function txPutMany<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        items.forEach((item) => store.put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function txDelete(storeName: string, id: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function txClearAndPutMany<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.clear();
        items.forEach((item) => store.put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

// ── Init / Seed ───────────────────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  await openDB();
  // Check if already seeded
  const meta = await txGetOne<{ id: string; value: string }>(STORES.meta, "seeded");
  if (meta?.value === "1") return;

  const now = new Date().toISOString();
  const products: Product[] = seedProducts.map((p) => ({ ...p, createdAt: now, updatedAt: now }));

  await txClearAndPutMany(STORES.products, products);
  await txClearAndPutMany(STORES.collections, seedCollections);
  await txClearAndPutMany(STORES.banners, seedBanners);
  await txClearAndPutMany(STORES.faqs, seedFAQs);
  await txClearAndPutMany(STORES.reviews, seedReviews);
  await txPut(STORES.settings, { id: "main", ...seedSettings });
  await txPut(STORES.meta, { id: "seeded", value: "1" });
}

export async function resetDB(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(Object.values(STORES), "readwrite");
    Object.values(STORES).forEach((s) => tx.objectStore(s).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await initDB();
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  return txGet<Product>(STORES.products);
}

export async function addProduct(product: Omit<Product, "createdAt" | "updatedAt">): Promise<Product> {
  const now = new Date().toISOString();
  const newProduct: Product = { ...product, createdAt: now, updatedAt: now };
  await txPut(STORES.products, newProduct);
  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const existing = await txGetOne<Product>(STORES.products, id);
  if (!existing) return;
  await txPut(STORES.products, { ...existing, ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteProduct(id: string): Promise<void> {
  await txDelete(STORES.products, id);
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function getCollections(): Promise<Collection[]> {
  return txGet<Collection>(STORES.collections);
}

export async function addCollection(collection: Collection): Promise<void> {
  await txPut(STORES.collections, collection);
}

export async function updateCollection(id: string, updates: Partial<Collection>): Promise<void> {
  const existing = await txGetOne<Collection>(STORES.collections, id);
  if (!existing) return;
  await txPut(STORES.collections, { ...existing, ...updates });
}

export async function deleteCollection(id: string): Promise<void> {
  await txDelete(STORES.collections, id);
}

// ── Banners ───────────────────────────────────────────────────────────────────

export async function getBanners(): Promise<Banner[]> {
  return txGet<Banner>(STORES.banners);
}

export async function addBanner(banner: Banner): Promise<void> {
  await txPut(STORES.banners, banner);
}

export async function updateBanner(id: string, updates: Partial<Banner>): Promise<void> {
  const existing = await txGetOne<Banner>(STORES.banners, id);
  if (!existing) return;
  await txPut(STORES.banners, { ...existing, ...updates });
}

export async function deleteBanner(id: string): Promise<void> {
  await txDelete(STORES.banners, id);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<StoreSettings> {
  const row = await txGetOne<StoreSettings & { id: string }>(STORES.settings, "main");
  return row ?? { id: "main", ...seedSettings };
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  await txPut(STORES.settings, { id: "main", ...settings });
}

// ── FAQs ──────────────────────────────────────────────────────────────────────

export async function getFAQs(): Promise<FAQItem[]> {
  return txGet<FAQItem>(STORES.faqs);
}

export async function addFAQ(faq: FAQItem): Promise<void> {
  await txPut(STORES.faqs, faq);
}

export async function updateFAQ(id: string, updates: Partial<FAQItem>): Promise<void> {
  const existing = await txGetOne<FAQItem>(STORES.faqs, id);
  if (!existing) return;
  await txPut(STORES.faqs, { ...existing, ...updates });
}

export async function deleteFAQ(id: string): Promise<void> {
  await txDelete(STORES.faqs, id);
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function getReviews(): Promise<ReviewItem[]> {
  return txGet<ReviewItem>(STORES.reviews);
}

export async function addReview(review: ReviewItem): Promise<void> {
  await txPut(STORES.reviews, review);
}

export async function updateReview(id: string, updates: Partial<ReviewItem>): Promise<void> {
  const existing = await txGetOne<ReviewItem>(STORES.reviews, id);
  if (!existing) return;
  await txPut(STORES.reviews, { ...existing, ...updates });
}

export async function deleteReview(id: string): Promise<void> {
  await txDelete(STORES.reviews, id);
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function getOrders(): Promise<Order[]> {
  return txGet<Order>(STORES.orders);
}

export async function addOrder(order: Order): Promise<void> {
  await txPut(STORES.orders, order);
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<void> {
  const existing = await txGetOne<Order>(STORES.orders, id);
  if (!existing) return;
  await txPut(STORES.orders, { ...existing, ...updates });
}
