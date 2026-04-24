/**
 * Public avatar image URL for a Firebase uid (DiceBear HTTP API; no API key).
 * Built on the server so every client (including the peer) uses the same URL.
 * @param {string} uid
 * @returns {string}
 */
export function avatarUrlForUid(uid) {
  const s = typeof uid === "string" && uid.trim() ? uid.trim() : "anonymous";
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(s)}`;
}
