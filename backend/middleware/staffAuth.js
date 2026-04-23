import { verifyIdToken } from "../lib/firebaseAdmin.js";
import { getAdminEmail } from "./adminAuth.js";

/**
 * Admin (configured email) or Firebase custom claim role === "moderator".
 * Sets req.staff = { uid, email, isAdmin, roleClaim }.
 */
export async function requireStaff(req, res, next) {
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
    const email = (decoded.email || "").toLowerCase();
    const roleClaim = typeof decoded.role === "string" ? decoded.role.toLowerCase() : "";
    const isAdmin = email === getAdminEmail();
    if (!isAdmin && roleClaim !== "moderator") {
      return res.status(403).json({ error: "Admin or moderator access required" });
    }
    req.staff = {
      uid: decoded.uid,
      email: decoded.email,
      isAdmin,
      roleClaim,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
