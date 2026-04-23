import { displayNameFromToken } from "./displayName.js";

/**
 * In-memory per-uid presence: name, session start, and last full disconnect.
 * Ref-counts multiple tabs per uid.
 */

/** @type {Map<string, { name: string, since: number, connections: number }>} */
const onlineByUid = new Map();

/** @type {Map<string, { name: string, at: number }>} */
const lastOnlineByUid = new Map();

/**
 * Call when a socket for this uid connects (tab open).
 * @param {import("firebase-admin").auth.DecodedIdToken | Record<string, unknown>} decoded
 */
export function registerConnection(decoded) {
  const uid = decoded.uid;
  if (!uid) {
    return;
  }
  const name = displayNameFromToken(decoded);
  const existing = onlineByUid.get(uid);
  if (existing) {
    existing.connections += 1;
    existing.name = name;
  } else {
    onlineByUid.set(uid, { name, since: Date.now(), connections: 1 });
  }
  lastOnlineByUid.delete(uid);
}

/**
 * Call when a socket disconnects. When ref hits 0, user is "offline" for this app.
 * @param {string} uid
 */
export function unregisterConnection(uid) {
  if (!uid) {
    return;
  }
  const rec = onlineByUid.get(uid);
  if (!rec) {
    return;
  }
  rec.connections -= 1;
  if (rec.connections <= 0) {
    onlineByUid.delete(uid);
    lastOnlineByUid.set(uid, { name: rec.name, at: Date.now() });
  }
}

/**
 * Snapshot for admin UI: merge with Firebase user rows.
 * @param {string} uid
 */
export function getPresenceForUid(uid) {
  const o = onlineByUid.get(uid);
  if (o) {
    return {
      isOnline: true,
      name: o.name,
      lastOnlineAt: null,
      sessionSince: new Date(o.since).toISOString(),
      hasConnectedToApp: true,
    };
  }
  const l = lastOnlineByUid.get(uid);
  if (l) {
    return {
      isOnline: false,
      name: l.name,
      lastOnlineAt: new Date(l.at).toISOString(),
      sessionSince: null,
      hasConnectedToApp: true,
    };
  }
  return {
    isOnline: false,
    name: null,
    lastOnlineAt: null,
    sessionSince: null,
    hasConnectedToApp: false,
  };
}

/**
 * @returns {Array<{ uid: string, name: string, sessionSince: string }>}
 */
export function listOnlineUsers() {
  const out = [];
  for (const [uid, v] of onlineByUid) {
    out.push({
      uid,
      name: v.name,
      sessionSince: new Date(v.since).toISOString(),
    });
  }
  return out;
}
