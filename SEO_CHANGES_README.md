# FabCoverz SEO Changes — What Was Done

## Files Changed / Added

### 1. `index.html` — MODIFIED
- Added full `<title>` with keywords
- Added `<meta name="description">` with rich keywords
- Added `<meta name="keywords">`
- Added `<meta name="robots" content="index, follow">`
- Added `<link rel="canonical" href="https://www.fabcoverz.store/">`
- Added Open Graph tags (og:title, og:description, og:image, og:url, og:type, og:locale)
- Added Twitter Card tags
- Added JSON-LD structured data (OnlineStore schema)

### 2. `src/utils/useSEO.ts` — NEW FILE
Dynamic SEO utility. Exports these functions:
- `seoHome()` — Home page SEO
- `seoCollections()` — Collections listing SEO
- `seoCollectionDetail(slug, name, image?)` — Per-collection SEO
- `seoProduct(id, title, desc, price, image?, availability?)` — Product page SEO with JSON-LD Product schema
- `seoPolicy(page)` — Policy pages SEO
- `seoTrackOrder()` — Track order SEO
- `applySEO(props)` — Generic low-level function

### 3. `src/App.tsx` — MODIFIED
Added a `useEffect` that calls the right SEO function whenever the page changes.
Location: After `trackPageView()` useEffect (~line 135).
Triggers on: `currentPage`, `selectedProductId`, `selectedCollectionSlug`, `activePolicyPage`, `products`, `collections`

### 4. `public/sitemap.xml` — NEW FILE
Lists all important pages for Google to crawl:
- Homepage (priority 1.0)
- Collections listing (priority 0.9)
- 8 collection pages (priority 0.8–0.85)
- Policy pages (priority 0.4–0.5)
- Track order (priority 0.6)

### 5. `public/robots.txt` — NEW FILE
- Allows all crawlers
- Blocks /admin and /live from indexing
- Points to sitemap

## After Deployment — Do This!

1. Go to https://search.google.com/search-console
2. Add property → fabcoverz.in
3. Verify ownership (HTML file method recommended)
4. Go to Sitemaps → Submit `https://www.fabcoverz.store/sitemap.xml`
5. Go to URL Inspection → test `https://www.fabcoverz.store/` → Request Indexing
6. Repeat URL Inspection for `/collections`, `/collections/metal-cases` etc.
7. Wait 1–4 weeks for Google to index

## Expected Results
- Product searches like "iPhone 16 Pro case India" → your product pages appear
- Brand search "FabCoverz" → rich result with logo
- WhatsApp share → shows proper preview image + title
- Google may show star ratings if enough orders exist (via Product schema)

