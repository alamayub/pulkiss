/**
 * Extract YouTube video ID from common URL shapes.
 * @param {string} input
 * @returns {string | null}
 */
export function parseYouTubeVideoId(input) {
  if (typeof input !== "string") {
    return null;
  }
  const s = input.trim();
  if (!s) {
    return null;
  }
  if (/^[\w-]{11}$/.test(s)) {
    return s;
  }
  try {
    const u = s.startsWith("http") ? new URL(s) : new URL(`https://${s}`);
    if (u.hostname === "youtu.be" || u.hostname === "www.youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && id.length === 11 ? id : null;
    }
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) {
        return v;
      }
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" && parts[1] && /^[\w-]{11}$/.test(parts[1])) {
        return parts[1];
      }
      if (parts[0] === "embed" && parts[1] && /^[\w-]{11}$/.test(parts[1])) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}
