import express from "express";
import { getAdmin } from "../lib/firebaseAdmin.js";
import { getPresenceForUid, listOnlineUsers } from "../lib/onlineRegistry.js";
import { requireAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

function serializeUser(r) {
  return {
    uid: r.uid,
    email: r.email || null,
    displayName: r.displayName || null,
    phoneNumber: r.phoneNumber || null,
    photoURL: r.photoURL || null,
    disabled: !!r.disabled,
    emailVerified: !!r.emailVerified,
    creationTime: r.metadata.creationTime,
    lastSignInTime: r.metadata.lastSignInTime,
    providerIds: (r.providerData || []).map((p) => p.providerId),
  };
}

/**
 * List users (paginated).
 * GET /api/admin/users?pageToken=...
 */
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const maxResults = Math.min(Number(req.query.maxResults) || 50, 1000);
    const pageToken = req.query.pageToken ? String(req.query.pageToken) : undefined;
    const list = await getAdmin().auth().listUsers(maxResults, pageToken);
    const users = list.users.map((r) => {
      const u = serializeUser(r);
      const p = getPresenceForUid(r.uid);
      return {
        ...u,
        presence: {
          isOnline: p.isOnline,
          name: p.name,
          lastOnlineAt: p.lastOnlineAt,
          sessionSince: p.sessionSince,
          hasConnectedToApp: p.hasConnectedToApp,
        },
      };
    });
    const onlineInApp = listOnlineUsers().length;
    return res.json({
      users,
      nextPageToken: list.pageToken || null,
      stats: { onlineInApp },
    });
  } catch (e) {
    console.error("admin listUsers", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

/**
 * PATCH /api/admin/users/:uid
 * Body: { displayName?, email?, phoneNumber? (null to clear E.164), disabled? }
 */
router.patch("/users/:uid", requireAdmin, async (req, res) => {
  const { uid } = req.params;
  if (!uid || !uid.length) {
    return res.status(400).json({ error: "Missing uid" });
  }
  const b = req.body || {};
  /** @type {import("firebase-admin").auth.UpdateRequest} */
  const updates = {};

  if (typeof b.displayName === "string") {
    updates.displayName = b.displayName.slice(0, 256) || null;
  }
  if (typeof b.email === "string") {
    const e = b.email.trim().toLowerCase();
    if (e) {
      updates.email = e;
    }
  }
  if (b.phoneNumber === null) {
    updates.phoneNumber = null;
  } else if (typeof b.phoneNumber === "string") {
    const p = b.phoneNumber.trim();
    updates.phoneNumber = p || null;
  }
  if (typeof b.disabled === "boolean") {
    updates.disabled = b.disabled;
  }
  if (typeof b.photoURL === "string") {
    updates.photoURL = b.photoURL.slice(0, 2048) || null;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  try {
    const rec = await getAdmin().auth().updateUser(uid, updates);
    const u = serializeUser(rec);
    return res.json({
      user: {
        ...u,
        presence: getPresenceForUid(rec.uid),
      },
    });
  } catch (e) {
    console.error("admin updateUser", e);
    return res.status(400).json({ error: e.message || "Update failed" });
  }
});

/**
 * DELETE /api/admin/users/:uid
 */
router.delete("/users/:uid", requireAdmin, async (req, res) => {
  const { uid } = req.params;
  if (!uid) {
    return res.status(400).json({ error: "Missing uid" });
  }
  try {
    await getAdmin().auth().deleteUser(uid);
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin deleteUser", e);
    return res.status(400).json({ error: e.message || "Delete failed" });
  }
});

export default router;
