import { randomUUID } from "node:crypto";
import { parseYouTubeVideoId } from "./youtube.js";

/** @typedef {"admin" | "member"} GroupRole */

/**
 * @typedef {Object} GroupRecord
 * @property {string} id
 * @property {string} name
 * @property {string | null} description
 * @property {string} createdBy
 * @property {number} createdAt
 */

/**
 * @typedef {Object} MemberRecord
 * @property {GroupRole} role
 * @property {string} name
 * @property {number} joinedAt
 */

/**
 * @typedef {Object} JoinRequestRecord
 * @property {string} name
 * @property {number} requestedAt
 */

/**
 * @typedef {Object} MessageRecord
 * @property {string} id
 * @property {string} text
 * @property {string} fromUid
 * @property {string} fromName
 * @property {number} createdAt
 */

/** @type {Map<string, GroupRecord>} */
const groups = new Map();
/** @type {Map<string, Map<string, MemberRecord>>} */
const membersByGroup = new Map();
/** @type {Map<string, Map<string, JoinRequestRecord>>} */
const joinRequestsByGroup = new Map();
/** @type {Map<string, MessageRecord[]>} messages in chronological order (oldest first) */
const messagesByGroup = new Map();

/** @type {Map<string, { queue: PlayerQueueItem[]; current: PlayerCurrent }>} */
const playerByGroup = new Map();

const MAX_GROUPS_LIST = 200;
const MESSAGES_PAGE = 50;
const MAX_PLAYER_QUEUE = 50;

/**
 * @typedef {Object} PlayerQueueItem
 * @property {string} id
 * @property {string} videoId
 * @property {string} addedByUid
 * @property {string} addedByName
 * @property {number} addedAt
 */

/**
 * @typedef {Object} PlayerCurrent
 * @property {string | null} currentItemId
 * @property {string | null} videoId
 * @property {boolean} isPlaying
 * @property {number} positionSec
 * @property {number} positionAtMs
 */

/**
 * @param {string} groupId
 * @returns {{ queue: PlayerQueueItem[]; current: PlayerCurrent }}
 */
function ensurePlayer(groupId) {
  let p = playerByGroup.get(groupId);
  if (!p) {
    const now = Date.now();
    p = {
      queue: [],
      current: {
        currentItemId: null,
        videoId: null,
        isPlaying: false,
        positionSec: 0,
        positionAtMs: now,
      },
    };
    playerByGroup.set(groupId, p);
  }
  return p;
}

/**
 * @param {ReturnType<typeof ensurePlayer>} p
 */
function effectivePositionSec(p) {
  const c = p.current;
  if (!c.isPlaying) {
    return c.positionSec;
  }
  return c.positionSec + (Date.now() - c.positionAtMs) / 1000;
}

/**
 * @param {string} groupId
 * @param {import("express").Request["user"]} reqUser
 * @param {string} url
 * @returns {{ ok: true, item: PlayerQueueItem } | { error: string }}
 */
export function addGroupPlayerQueueItem(groupId, reqUser, url) {
  if (!groups.get(groupId)) {
    return { error: "not_found" };
  }
  if (!getRole(groupId, reqUser.uid)) {
    return { error: "not_member" };
  }
  const videoId = parseYouTubeVideoId(String(url));
  if (!videoId) {
    return { error: "invalid_youtube" };
  }
  const p = ensurePlayer(groupId);
  if (p.queue.length >= MAX_PLAYER_QUEUE) {
    return { error: "queue_full" };
  }
  const now = Date.now();
  const id = randomUUID();
  const item = {
    id,
    videoId,
    addedByUid: reqUser.uid,
    addedByName: reqUser.name || reqUser.uid,
    addedAt: now,
  };
  p.queue.push(item);
  return { ok: true, item };
}

/**
 * @param {string} groupId
 * @param {string} action
 * @param {Record<string, unknown>} body
 * @param {string} adminUid
 */
export function runGroupPlayerAdminCommand(groupId, action, body, adminUid) {
  if (!groups.get(groupId)) {
    return { error: "not_found" };
  }
  if (getRole(groupId, adminUid) !== "admin") {
    return { error: "forbidden" };
  }
  const p = ensurePlayer(groupId);
  const c = p.current;
  const now = Date.now();
  if (action === "play") {
    if (!c.videoId) {
      return { error: "no_video" };
    }
    if (c.isPlaying) {
      return { ok: true };
    }
    c.isPlaying = true;
    c.positionAtMs = now;
    return { ok: true };
  }
  if (action === "pause") {
    if (c.isPlaying) {
      c.positionSec = effectivePositionSec(p);
    }
    c.isPlaying = false;
    c.positionAtMs = now;
    return { ok: true };
  }
  if (action === "seek") {
    const sec = typeof body?.positionSec === "number" ? body.positionSec : Number(body?.positionSec);
    if (Number.isNaN(sec) || sec < 0) {
      return { error: "invalid_seek" };
    }
    c.positionSec = sec;
    c.positionAtMs = now;
    return { ok: true };
  }
  if (action === "remove" && body?.itemId) {
    const iid = String(body.itemId);
    p.queue = p.queue.filter((q) => q.id !== iid);
    if (c.currentItemId === iid) {
      c.currentItemId = null;
      c.videoId = null;
      c.isPlaying = false;
      c.positionSec = 0;
      c.positionAtMs = now;
    }
    return { ok: true };
  }
  if (action === "setCurrent" && body?.itemId) {
    const iid = String(body.itemId);
    const it = p.queue.find((q) => q.id === iid);
    if (!it) {
      return { error: "not_in_queue" };
    }
    c.currentItemId = it.id;
    c.videoId = it.videoId;
    c.isPlaying = true;
    c.positionSec = 0;
    c.positionAtMs = now;
    return { ok: true };
  }
  if (action === "next") {
    if (p.queue.length === 0) {
      return { error: "empty_queue" };
    }
    if (!c.currentItemId) {
      const first = p.queue[0];
      c.currentItemId = first.id;
      c.videoId = first.videoId;
      c.isPlaying = true;
      c.positionSec = 0;
      c.positionAtMs = now;
      return { ok: true };
    }
    const idx = p.queue.findIndex((q) => q.id === c.currentItemId);
    const nextIdx = idx >= 0 ? idx + 1 : 0;
    if (nextIdx >= p.queue.length) {
      return { error: "no_next" };
    }
    const next = p.queue[nextIdx];
    c.currentItemId = next.id;
    c.videoId = next.videoId;
    c.isPlaying = true;
    c.positionSec = 0;
    c.positionAtMs = now;
    return { ok: true };
  }
  if (action === "stop") {
    c.currentItemId = null;
    c.videoId = null;
    c.isPlaying = false;
    c.positionSec = 0;
    c.positionAtMs = now;
    return { ok: true };
  }
  return { error: "unknown_action" };
}

/**
 * Internal snapshot for a group’s player (members only; same for all members).
 * @param {string} groupId
 */
function buildGroupPlayerStateSnapshot(groupId) {
  const p = ensurePlayer(groupId);
  const c = p.current;
  const now = Date.now();
  const pos = c.isPlaying && c.videoId ? effectivePositionSec(p) : c.positionSec;
  return {
    serverTime: now,
    queue: p.queue.map((q) => ({
      id: q.id,
      videoId: q.videoId,
      addedByUid: q.addedByUid,
      addedByName: q.addedByName,
      addedAt: new Date(q.addedAt).toISOString(),
    })),
    current: {
      currentItemId: c.currentItemId,
      videoId: c.videoId,
      isPlaying: c.isPlaying,
      positionSec: pos,
      positionAtMs: now,
    },
  };
}

/**
 * Serializable player state (HTTP + sockets). Not a member → `null`.
 * @param {string} groupId
 * @param {string | null} viewerUid
 */
export function getGroupPlayerStateForClient(groupId, viewerUid) {
  if (!groups.get(groupId) || !viewerUid || !getRole(groupId, viewerUid)) {
    return null;
  }
  return buildGroupPlayerStateSnapshot(groupId);
}

/**
 * Snapshot for socket broadcast to members in a room.
 * @param {string} groupId
 * @returns {ReturnType<typeof buildGroupPlayerStateSnapshot> | null}
 */
export function getGroupPlayerStateSnapshot(groupId) {
  if (!getGroupById(groupId)) {
    return null;
  }
  return buildGroupPlayerStateSnapshot(groupId);
}

function membersMap(groupId) {
  let m = membersByGroup.get(groupId);
  if (!m) {
    m = new Map();
    membersByGroup.set(groupId, m);
  }
  return m;
}

function joinMap(groupId) {
  let m = joinRequestsByGroup.get(groupId);
  if (!m) {
    m = new Map();
    joinRequestsByGroup.set(groupId, m);
  }
  return m;
}

function messagesList(groupId) {
  let list = messagesByGroup.get(groupId);
  if (!list) {
    list = [];
    messagesByGroup.set(groupId, list);
  }
  return list;
}

/**
 * @param {import("express").Request} reqUser from requireAuth: { uid, name }
 * @param {string} name
 * @param {string | null} description
 */
export function createGroup(reqUser, name, description) {
  const id = randomUUID();
  const now = Date.now();
  groups.set(id, {
    id,
    name,
    description,
    createdBy: reqUser.uid,
    createdAt: now,
  });
  const mm = new Map();
  mm.set(reqUser.uid, { role: "admin", name: reqUser.name, joinedAt: now });
  membersByGroup.set(id, mm);
  joinRequestsByGroup.set(id, new Map());
  messagesByGroup.set(id, []);
  return { id, name, description, createdBy: reqUser.uid };
}

/**
 * @param {string} meUid
 */
export function listGroupsSummary(meUid) {
  const arr = [...groups.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_GROUPS_LIST);
  return arr.map((g) => {
    const mm = membersByGroup.get(g.id);
    const memberCount = mm ? mm.size : 0;
    const isMember = mm ? mm.has(meUid) : false;
    const jm = joinRequestsByGroup.get(g.id);
    const hasPendingRequest = jm ? jm.has(meUid) : false;
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      createdBy: g.createdBy,
      createdAt: new Date(g.createdAt).toISOString(),
      memberCount,
      isMember,
      hasPendingRequest,
    };
  });
}

/**
 * @param {string} groupId
 * @param {string} uid
 * @returns {"admin" | "member" | null}
 */
export function getRole(groupId, uid) {
  const mm = membersByGroup.get(groupId);
  if (!mm) {
    return null;
  }
  const m = mm.get(uid);
  if (!m) {
    return null;
  }
  return m.role === "admin" ? "admin" : "member";
}

export function getGroupById(groupId) {
  return groups.get(groupId) || null;
}

export function deleteGroupCascade(groupId) {
  groups.delete(groupId);
  membersByGroup.delete(groupId);
  joinRequestsByGroup.delete(groupId);
  messagesByGroup.delete(groupId);
  playerByGroup.delete(groupId);
}

/**
 * @param {string} groupId
 * @param {import("express").Request["user"]} reqUser
 */
export function addJoinRequest(groupId, reqUser) {
  const g = groups.get(groupId);
  if (!g) {
    return { error: "not_found" };
  }
  const mm = membersMap(groupId);
  if (mm.has(reqUser.uid)) {
    return { error: "already_member" };
  }
  const jm = joinMap(groupId);
  if (jm.has(reqUser.uid)) {
    return { error: "already_pending" };
  }
  jm.set(reqUser.uid, { name: reqUser.name, requestedAt: Date.now() });
  return { ok: true };
}

/**
 * @param {string} groupId
 * @param {string} targetUid
 */
export function acceptJoinRequest(groupId, targetUid) {
  const jm = joinRequestsByGroup.get(groupId);
  if (!jm || !jm.has(targetUid)) {
    return { error: "no_request" };
  }
  const d = jm.get(targetUid);
  jm.delete(targetUid);
  const mm = membersMap(groupId);
  mm.set(targetUid, { role: "member", name: d?.name || targetUid, joinedAt: Date.now() });
  return { ok: true };
}

/**
 * @param {string} groupId
 * @param {string} targetUid
 */
export function rejectJoinRequest(groupId, targetUid) {
  const jm = joinRequestsByGroup.get(groupId);
  if (!jm || !jm.has(targetUid)) {
    return { error: "no_request" };
  }
  jm.delete(targetUid);
  return { ok: true };
}

/**
 * @param {string} groupId
 * @param {string} targetUid
 */
export function removeMember(groupId, targetUid) {
  const mm = membersByGroup.get(groupId);
  if (!mm || !mm.has(targetUid)) {
    return { error: "not_member" };
  }
  mm.delete(targetUid);
  return { ok: true };
}

/**
 * @param {string} groupId
 * @param {string} uid
 * @returns {{ ok: true, groupDeleted?: true, promotedNewAdmin?: string } | { error: string }}
 */
export function leaveGroup(groupId, uid) {
  const mm = membersByGroup.get(groupId);
  if (!mm || !mm.has(uid)) {
    return { error: "not_member" };
  }
  if (!groups.has(groupId)) {
    return { error: "not_found" };
  }
  if (mm.size === 1) {
    deleteGroupCascade(groupId);
    return { ok: true, groupDeleted: true };
  }
  const m = mm.get(uid);
  mm.delete(uid);
  if (m?.role === "admin" && mm.size > 0) {
    const first = mm.keys().next();
    if (!first.done) {
      const promoteUid = first.value;
      const promoted = mm.get(promoteUid);
      if (promoted) {
        promoted.role = "admin";
        mm.set(promoteUid, promoted);
      }
      return { ok: true, promotedNewAdmin: promoteUid };
    }
  }
  return { ok: true };
}

/**
 * @param {string} groupId
 * @param {string} [beforeMessageId]
 * @param {number} [limit]
 * @returns {{ messages: Array<{id: string, text: string, fromUid: string, fromName: string, createdAt: string}>, hasMore: boolean }}
 */
export function getMessagesPage(groupId, beforeMessageId, limit = MESSAGES_PAGE) {
  const all = messagesList(groupId);
  const cap = Math.min(Math.max(1, limit), 100);
  if (!beforeMessageId) {
    const chunk = all.slice(-cap);
    const out = chunk
      .slice()
      .reverse()
      .map(serializeMessage);
    const hasMore = all.length > cap;
    return { messages: out, hasMore };
  }
  const idx = all.findIndex((m) => m.id === beforeMessageId);
  if (idx <= 0) {
    return { messages: [], hasMore: false };
  }
  const older = all.slice(0, idx);
  const chunk = older.slice(-cap);
  const out = chunk
    .slice()
    .reverse()
    .map(serializeMessage);
  const hasMore = older.length > cap;
  return { messages: out, hasMore };
}

/** @param {MessageRecord} m */
function serializeMessage(m) {
  return {
    id: m.id,
    text: m.text,
    fromUid: m.fromUid,
    fromName: m.fromName,
    createdAt: new Date(m.createdAt).toISOString(),
  };
}

/**
 * @param {string} groupId
 * @param {import("express").Request["user"]} reqUser
 * @param {string} text
 */
export function postMessage(groupId, reqUser, text) {
  const list = messagesList(groupId);
  const id = randomUUID();
  const now = Date.now();
  const msg = { id, text, fromUid: reqUser.uid, fromName: reqUser.name, createdAt: now };
  list.push(msg);
  return serializeMessage(msg);
}

/**
 * @param {string} groupId
 * @param {string} uidViewer
 */
export function getGroupDetailForViewer(groupId, uidViewer) {
  const g = groups.get(groupId);
  if (!g) {
    return null;
  }
  const mm = membersByGroup.get(groupId) || new Map();
  const members = [...mm.entries()].map(([uid, x]) => ({
    uid,
    name: x.name || uid,
    role: x.role,
    joinedAt: new Date(x.joinedAt).toISOString(),
  }));
  const isMember = mm.has(uidViewer);
  const rec = mm.get(uidViewer);
  const isAdmin = rec?.role === "admin";
  const jm = joinRequestsByGroup.get(groupId);
  const hasPendingRequest = jm ? jm.has(uidViewer) : false;
  let joinRequests = [];
  if (isAdmin && jm) {
    joinRequests = [...jm.entries()].map(([uid, x]) => ({
      uid,
      name: x.name || uid,
      requestedAt: new Date(x.requestedAt).toISOString(),
    }));
  }
  return {
    group: {
      id: g.id,
      name: g.name,
      description: g.description,
      createdBy: g.createdBy,
      createdAt: new Date(g.createdAt).toISOString(),
    },
    isMember,
    isAdmin,
    hasPendingRequest,
    members,
    joinRequests,
    player: isMember ? getGroupPlayerStateForClient(groupId, uidViewer) : null,
  };
}

export { MESSAGES_PAGE, MAX_GROUPS_LIST };
