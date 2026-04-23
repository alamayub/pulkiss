import { verifyIdToken } from "../lib/firebaseAdmin.js";

function getAdminEmail() {
  return (process.env.ADMIN_EMAIL || "ayub@gmail.com").trim().toLowerCase();
}

/**
 * Verifies Firebase ID token and that the user email is the configured admin.
 */
async function requireAdmin(req, res, next) {
  const h = req.headers.authorization;
  const token = h && h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = await verifyIdToken(token);
    const email = (decoded.email || "").toLowerCase();
    if (email !== getAdminEmail()) {
      return res.status(403).json({ error: "Admin access only" });
    }
    req.admin = { uid: decoded.uid, email: decoded.email };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export { requireAdmin, getAdminEmail };
