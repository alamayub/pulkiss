import express from "express";
import { getAdmin } from "../lib/firebaseAdmin.js";
import { createAuthUser } from "../lib/createAuthUser.js";
import { getStaffAssignableRoles } from "../lib/staffAssignableRoles.js";
import { getPresenceForUid, listOnlineUsers } from "../lib/onlineRegistry.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { requireStaff } from "../middleware/staffAuth.js";

const router = express.Router();

const MAX_NAME = 128;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

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

/** @param {import("firebase-admin").auth.UserRecord} r */
function listUserPayload(r) {
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
}

/**
 * @param {import("firebase-admin").auth.UserRecord} r
 * @param {{ name?: string | null }} presence
 * @param {string} qLower
 */
function userRecordMatchesQuery(r, presence, qLower) {
  const hay = [
    r.uid,
    r.email || "",
    r.displayName || "",
    presence?.name || "",
  ]
    .join("\n")
    .toLowerCase();
  return hay.includes(qLower);
}

/**
 * Roles staff may assign when creating users (admin email or moderator).
 * GET /api/admin/role-options
 */
router.get("/role-options", requireStaff, (_req, res) => {
  return res.json({ roles: getStaffAssignableRoles() });
});

/**
 * Create a Firebase user with a chosen role (no auto sign-in token).
 * POST /api/admin/users  body: { email, password, fullName, role }
 */
router.post("/users", requireStaff, async (req, res) => {
  const emailRaw = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";
  const roleRaw = typeof req.body?.role === "string" ? req.body.role.trim().toLowerCase() : "";

  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return res.status(400).json({ error: `Password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters` });
  }
  if (!fullName || fullName.length > MAX_NAME) {
    return res.status(400).json({ error: `Full name is required (max ${MAX_NAME} characters)` });
  }

  const allowed = getStaffAssignableRoles();
  if (!roleRaw || !allowed.includes(roleRaw)) {
    return res.status(400).json({
      error: `Role must be one of: ${allowed.join(", ")}`,
      allowedRoles: allowed,
    });
  }

  try {
    const created = await createAuthUser({ emailRaw, password, fullName, role: roleRaw });
    return res.status(201).json({
      user: {
        uid: created.uid,
        email: created.email,
        displayName: created.displayName,
        role: created.role,
      },
    });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    if (code === "auth/email-already-exists") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    if (code === "auth/invalid-email") {
      return res.status(400).json({ error: "Invalid email" });
    }
    if (code === "auth/weak-password") {
      return res.status(400).json({ error: "Password is too weak for Firebase" });
    }
    console.error("admin create user", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Create user failed" });
  }
});

/**
 * Search users: exact email / UID when possible, otherwise paginated scan (substring on name, email, UID, in-app name).
 * GET /api/admin/users/search?q=...
 */
router.get("/users/search", requireStaff, async (req, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!raw.length) {
    return res.status(400).json({ error: "Missing query parameter `q`" });
  }
  if (raw.length > 200) {
    return res.status(400).json({ error: "Search text is too long" });
  }

  const qLower = raw.toLowerCase();
  const auth = getAdmin().auth();

  try {
    if (raw.includes("@")) {
      const email = raw.toLowerCase();
      try {
        const r = await auth.getUserByEmail(email);
        return res.json({ users: [listUserPayload(r)] });
      } catch (e) {
        const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
        if (code !== "auth/user-not-found") {
          console.error("admin search getUserByEmail", e);
          return res.status(500).json({ error: e instanceof Error ? e.message : "Search failed" });
        }
      }
    }

    try {
      const r = await auth.getUser(raw);
      return res.json({ users: [listUserPayload(r)] });
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
      if (code !== "auth/user-not-found") {
        console.error("admin search getUser", e);
        return res.status(500).json({ error: e instanceof Error ? e.message : "Search failed" });
      }
    }

    const matches = [];
    const maxPages = 50;
    const batchSize = 1000;
    const maxMatches = 100;
    let pageToken;

    for (let page = 0; page < maxPages && matches.length < maxMatches; page += 1) {
      const list = await auth.listUsers(batchSize, pageToken);
      for (const r of list.users) {
        const p = getPresenceForUid(r.uid);
        if (userRecordMatchesQuery(r, p, qLower)) {
          matches.push(listUserPayload(r));
          if (matches.length >= maxMatches) {
            break;
          }
        }
      }
      if (!list.pageToken) {
        break;
      }
      pageToken = list.pageToken;
    }

    return res.json({ users: matches });
  } catch (e) {
    console.error("admin users search", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Search failed" });
  }
});

/**
 * List users (paginated).
 * GET /api/admin/users?pageToken=...
 */
router.get("/users", requireStaff, async (req, res) => {
  try {
    const maxResults = Math.min(Number(req.query.maxResults) || 50, 1000);
    const pageToken = req.query.pageToken ? String(req.query.pageToken) : undefined;
    const list = await getAdmin().auth().listUsers(maxResults, pageToken);
    const users = list.users.map((r) => listUserPayload(r));
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
