const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
const normalizedApiUrl = rawApiUrl.replace(/\/+$/, "");

export const API_URL = normalizedApiUrl.endsWith("/api")
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;
