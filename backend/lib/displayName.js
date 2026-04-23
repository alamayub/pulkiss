/**
 * @param {import("firebase-admin").auth.DecodedIdToken | Record<string, unknown>} decoded
 * @returns {string}
 */
export function displayNameFromToken(decoded) {
  if (!decoded) {
    return "User";
  }
  if (typeof decoded.name === "string" && decoded.name.trim()) {
    return decoded.name.trim();
  }
  if (typeof decoded.email === "string" && decoded.email.trim()) {
    return decoded.email.trim();
  }
  if (typeof decoded.phone_number === "string" && decoded.phone_number.trim()) {
    return decoded.phone_number.trim();
  }
  if (typeof decoded.uid === "string") {
    return decoded.uid;
  }
  return "User";
}
