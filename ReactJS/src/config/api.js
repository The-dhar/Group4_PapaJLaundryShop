const rawApiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:3000";
const normalizedApiUrl = rawApiUrl.replace(/\/+$/, "");

export const API_URL = normalizedApiUrl.endsWith("/api")
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;