export const THEME_STORAGE_KEY = "pulkiss-theme";

/** @returns {"light" | "dark"} */
export function getStoredTheme() {
  if (typeof window === "undefined") {
    return "dark";
  }
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** @param {"light" | "dark"} theme */
export function setTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", t === "light" ? "#e8ecf3" : "#0f1419");
  }
}

export function initTheme() {
  setTheme(getStoredTheme());
}
