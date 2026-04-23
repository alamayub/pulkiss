/**
 * In dev, Vite proxies /api and /socket.io to the backend, so use same origin.
 * In production, set VITE_API_BASE to your API origin.
 */
export function getSocketUrl() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}
