/**
 * The `cloudinary` SDK (lib/cloudinary.ts) is server-only — it's configured
 * with API secrets and can't be imported into "use client" components. Most
 * of this app's image rendering happens in client components (MediaGrid,
 * EvidencePanel, CompareClient, etc.), so those need a way to request
 * optimized delivery without pulling in the server SDK. This module is pure
 * string manipulation on an existing Cloudinary delivery URL — safe anywhere.
 */

/**
 * Inserts a transformation string into a Cloudinary delivery URL, right
 * after "/upload/". If the URL doesn't look like a Cloudinary delivery URL,
 * returns it unchanged rather than breaking the image render.
 */
export function withCloudinaryTransform(secureUrl: string, transformation: string): string {
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return secureUrl;
  const insertAt = idx + marker.length;
  return `${secureUrl.slice(0, insertAt)}${transformation}/${secureUrl.slice(insertAt)}`;
}

/**
 * Auto format (f_auto: WebP/AVIF where supported) + auto quality (q_auto) —
 * Cloudinary's own core recommendation for any delivered image. Optionally
 * caps width so grid thumbnails don't pull full-resolution originals.
 */
export function optimizedImageUrl(secureUrl: string, opts?: { width?: number }): string {
  const parts = ["f_auto", "q_auto"];
  if (opts?.width) parts.push(`w_${opts.width}`);
  return withCloudinaryTransform(secureUrl, parts.join(","));
}
