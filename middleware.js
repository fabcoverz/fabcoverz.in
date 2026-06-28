/**
 * middleware.js — Vercel Edge Middleware
 * No next/server — uses standard Web APIs only.
 *
 * For bot/crawler requests on /products/* and /collections/* and the
 * legacy ?product= URL, this middleware INTERNALLY fetches /api/og and
 * returns that HTML directly to the bot — WITHOUT issuing an HTTP
 * redirect. This is critical: if we redirect the bot to /api/og, and
 * /api/og's response then points back at the original /products/ URL
 * (e.g. via canonical or meta-refresh), the bot bounces back here and
 * gets redirected again — an infinite redirect loop ("redirecting too
 * many times"), which is exactly what broke Google Merchant Center
 * indexing.
 *
 * By fetching /api/og server-side and returning its body as-is (same
 * URL, status 200, no redirect), the bot sees ONE response at the
 * original URL it requested. Real users (non-bots) pass through
 * untouched to the React SPA.
 */

const BOT_UA = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "slackbot",
  "discordbot",
  "googlebot",
  "google-inspectiontool",
  "storebot-google",      // Google Merchant / Shopping crawler
  "apis-google",
  "bingbot",
  "applebot",
  "pinterest",
  "vkshare",
  "metainspector",
  "ahrefsbot",
  "semrushbot",
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_UA.some(bot => ua.includes(bot));
}

/** Extract product id from /products/<slug>--<id> */
function extractProductId(pathname) {
  if (!pathname.startsWith("/products/")) return null;
  const segment = pathname.replace("/products/", "");
  const idx = segment.lastIndexOf("--");
  if (idx !== -1) return segment.slice(idx + 2);
  return segment || null;
}

export default async function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!isBot(ua)) return; // undefined = pass through to SPA

  const url = new URL(request.url);
  const { pathname, searchParams } = url;

  let ogUrl = null;

  // Pattern 1: /products/<slug>--<id>  ← NEW clean URL from feed
  const productIdFromPath = extractProductId(pathname);
  if (productIdFromPath) {
    ogUrl = new URL("/api/og", url.origin);
    ogUrl.searchParams.set("type", "product");
    ogUrl.searchParams.set("id", productIdFromPath);
  }

  // Pattern 2: /?product=<id>  ← legacy URL (still works)
  if (!ogUrl) {
    const productId = searchParams.get("product");
    if (productId) {
      ogUrl = new URL("/api/og", url.origin);
      ogUrl.searchParams.set("type", "product");
      ogUrl.searchParams.set("id", productId);
    }
  }

  // Pattern 3: /collections/<slug>
  if (!ogUrl && pathname.startsWith("/collections/")) {
    const parts = pathname.replace("/collections/", "").split("/");
    const slug = parts[0];
    if (slug) {
      ogUrl = new URL("/api/og", url.origin);
      ogUrl.searchParams.set("type", "collection");
      ogUrl.searchParams.set("slug", slug);
    }
  }

  if (!ogUrl) return; // not a route we handle for bots — pass through

  // Fetch the OG HTML server-side and return it directly — no redirect,
  // so the bot's request URL never changes and never loops.
  try {
    const ogResponse = await fetch(ogUrl.toString(), {
      headers: { "user-agent": ua },
    });
    const html = await ogResponse.text();
    return new Response(html, {
      status: ogResponse.status,
      headers: {
        "Content-Type": ogResponse.headers.get("Content-Type") || "text/html; charset=utf-8",
        "Cache-Control": ogResponse.headers.get("Cache-Control") || "s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    // On failure, pass through to the SPA rather than breaking the request
    return;
  }
}

export const config = {
  matcher: ["/((?!_vercel|api|assets|_next).*)" ],
};
