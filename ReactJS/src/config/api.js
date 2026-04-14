const rawApiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:3000";
const normalizedApiUrl = rawApiUrl.replace(/\/+$/, "");

export const API_URL = normalizedApiUrl.endsWith("/api")
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

const API_ORIGIN = API_URL.replace(/\/api\/?$/i, "");

export function resolvePublicFileUrl(url) {
  if (url == null || url === "") return null;

  let apiOrigin;
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
    if (String(url).startsWith("/")) {
      return `${apiOrigin}${url}`;
    }
    return url;
  }
}