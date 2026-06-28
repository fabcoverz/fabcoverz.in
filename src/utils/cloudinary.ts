/**
 * cloudinary.ts — Upload images to Cloudinary via unsigned upload preset.
 *
 * Setup required (one-time in Cloudinary dashboard):
 *   Settings → Upload → Upload Presets → Add preset
 *   Name: fabcoverz_unsigned   Mode: Unsigned   Folder: fabcoverz
 *
 * Returns the secure_url of the uploaded image.
 */

const CLOUD_NAME = "dwpoqtu3a";
const UPLOAD_PRESET = "fabcoverz_unsigned"; // Create this in Cloudinary dashboard

/**
 * Upload a File or base64 data URL to Cloudinary.
 * Returns the CDN secure_url.
 */
export async function uploadToCloudinary(
  source: File | string,
  folder = "fabcoverz"
): Promise<string> {
  const formData = new FormData();
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  if (typeof source === "string") {
    // base64 data URL  (e.g. "data:image/jpeg;base64,...")
    formData.append("file", source);
  } else {
    formData.append("file", source);
  }

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary upload failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.secure_url as string;
}

/**
 * Convenience: resize + compress a File with canvas, then upload.
 * Returns Cloudinary URL.
 */
export async function processAndUpload(
  file: File,
  maxW = 800,
  maxH = 1000,
  folder = "fabcoverz"
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error("Image must be under 15MB"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
        if (h > maxH) { w = Math.round((w * maxH) / h); h = maxH; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        try {
          const url = await uploadToCloudinary(dataUrl, folder);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary URL optimizer — auto quality + format + resize
// Use this instead of raw Cloudinary URLs for fast loading.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given any Cloudinary URL, inject transformation params for fast loading.
 * - f_auto  → WebP/AVIF for supported browsers (smaller size)
 * - q_auto  → automatic quality (Cloudinary picks best quality/size ratio)
 * - w_{width} → resize to needed width (don't download 2000px for a 400px card)
 *
 * Non-Cloudinary URLs are returned as-is.
 */
export function cdnImg(url: string, width = 800): string {
  if (!url) return url;
  // Only transform Cloudinary URLs
  if (!url.includes("res.cloudinary.com")) return url;
  // Already has /upload/ transformations — inject after /upload/
  return url.replace(
    "/upload/",
    `/upload/f_auto,q_auto:good,w_${width},c_limit/`
  );
}

/**
 * Thumbnail variant — for cards and grids.
 */
export function cdnThumb(url: string): string {
  return cdnImg(url, 400);
}

/**
 * LQIP (Low Quality Image Placeholder) — tiny blurred preview (30px wide).
 * Use as `src` while the real image loads, then swap to cdnThumb/cdnImg.
 * This gives visitors an instant blurred preview instead of blank white.
 */
export function cdnLqip(url: string): string {
  if (!url) return url;
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace(
    "/upload/",
    "/upload/f_auto,q_1,w_30,e_blur:400/"
  );
}

/**
 * srcSet string for responsive images — browser picks best size automatically.
 * Use on product images where display size varies by viewport.
 */
export function cdnSrcSet(url: string): string {
  if (!url || !url.includes("res.cloudinary.com")) return "";
  const sizes = [200, 400, 600, 800, 1000];
  return sizes
    .map(w => `${url.replace("/upload/", `/upload/f_auto,q_auto:good,w_${w},c_limit/`)} ${w}w`)
    .join(", ");
}

/**
 * Collection tile image — high quality for collection grid cards.
 */
export function cdnCollectionImg(url: string): string {
  return cdnImg(url, 800);
}
