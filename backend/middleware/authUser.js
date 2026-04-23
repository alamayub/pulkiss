import { verifyIdToken } from "../lib/firebaseAdmin.js";
import { displayNameFromToken } from "../lib/displayName.js";

/**
 * Sets req.user = { uid, name } from the Firebase ID token.
 */
export async function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = h && h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = await verifyIdToken(token);
    if (!decoded?.uid) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.user = { uid: decoded.uid, name: displayNameFromToken(decoded) };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
