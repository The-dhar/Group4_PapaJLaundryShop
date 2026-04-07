const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
const normalizedApiUrl = rawApiUrl.replace(/\/+$/, "");

export const API_URL = normalizedApiUrl.endsWith("/api")
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

/** Origin of the API (no `/api`), used to fix asset URLs that point at localhost. */
const API_ORIGIN = API_URL.replace(/\/api\/?$/i, "");

/**
 * Rewrites `image_url` from the API when it still uses localhost/127.0.0.1 so images load on device.
 */
export function resolvePublicFileUrl(url: string | null | undefined): string | null {
  if (url == null || url === "") return null;
  let apiOrigin: string;
  try {
    apiOrigin = new URL(API_ORIGIN).origin;
  } catch {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${apiOrigin}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    if (url.startsWith("/")) return `${apiOrigin}${url}`;
    return url;
  }
}
