/**
 * Deterministic “logo” for a group: small SVG as a UTF-8 data URL (no client upload).
 * @param {string} id
 * @returns {number}
 */
function hueFromId(id) {
  let h = 216;
  for (let i = 0; i < id.length; i++) {
    h = (h * 33 + id.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/**
 * @param {string} name
 * @returns {string} single display character
 */
function pickLetter(name) {
  const s = String(name || "").trim();
  for (const ch of s) {
    if (/[\p{L}\p{N}]/u.test(ch)) {
      return ch.toUpperCase();
    }
  }
  return "?";
}

/**
 * @param {string} ch
 */
function escapeXmlText(ch) {
  return ch
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} name
 * @param {string} id group UUID
 * @returns {string} data:image/svg+xml URL
 */
export function generateGroupLogoDataUrl(name, id) {
  const h = hueFromId(id);
  const h2 = (h + 44) % 360;
  const letter = escapeXmlText(pickLetter(name));
  const gid = id.replace(/-/g, "").slice(0, 14);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="lg${gid}" x1="8%" y1="0%" x2="92%" y2="100%"><stop offset="0%" stop-color="hsl(${h} 58% 44%)"/><stop offset="100%" stop-color="hsl(${h2} 52% 30%)"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#lg${gid})"/><text x="64" y="78" font-family="system-ui,Segoe UI,sans-serif" font-size="52" font-weight="800" fill="rgba(255,255,255,0.94)" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
