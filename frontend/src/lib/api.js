import { getFirebaseAuth } from "./firebase";

function apiBase() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "";
  }
  return window.location.origin;
}

export async function apiFetch(path, options = {}) {
  const auth = getFirebaseAuth();
  const u = auth.currentUser;
  if (!u) {
    throw new Error("Not signed in");
  }
  const token = await u.getIdToken();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };
  const r = await fetch(`${apiBase()}${path.startsWith("/") ? path : `/${path}`}`, { ...options, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || r.statusText || "Request failed");
    err.data = data;
    err.status = r.status;
    throw err;
  }
  return data;
}

export async function loadIceServers() {
  try {
    const r = await fetch(`${apiBase()}/api/ice`);
    const data = await r.json();
    if (data && Array.isArray(data.iceServers) && data.iceServers.length) {
      return data.iceServers;
    }
  } catch {
    // ignore
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

export async function fetchPresenceCount() {
  const r = await fetch(`${apiBase()}/api/presence`);
  const data = await r.json().catch(() => ({}));
  if (data && typeof data.count === "number") {
    return data.count;
  }
  return 0;
}

/** @param {string | undefined} pageToken */
export async function adminListUsers(pageToken) {
  const q = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
  return apiFetch(`/api/admin/users${q}`);
}

/** @param {string} uid @param {Record<string, unknown>} body */
export async function adminUpdateUser(uid, body) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function adminDeleteUser(uid) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "DELETE",
  });
}

// --- Groups (in-memory API) ---

export async function groupsList() {
  return apiFetch("/api/groups");
}

/** @param {{ name: string, description?: string }} body */
export async function groupsCreate(body) {
  return apiFetch("/api/groups", { method: "POST", body: JSON.stringify(body) });
}

export async function groupsGet(groupId) {
  return apiFetch(`/api/groups/${encodeURIComponent(groupId)}`);
}

export async function groupsJoinRequest(groupId) {
  return apiFetch(`/api/groups/${encodeURIComponent(groupId)}/join-request`, { method: "POST", body: "{}" });
}

export async function groupsAcceptRequest(groupId, targetUid) {
  return apiFetch(
    `/api/groups/${encodeURIComponent(groupId)}/requests/${encodeURIComponent(targetUid)}/accept`,
    { method: "POST", body: "{}" }
  );
}

export async function groupsRejectRequest(groupId, targetUid) {
  return apiFetch(
    `/api/groups/${encodeURIComponent(groupId)}/requests/${encodeURIComponent(targetUid)}/reject`,
    { method: "POST", body: "{}" }
  );
}

export async function groupsRemoveMember(groupId, targetUid) {
  return apiFetch(`/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(targetUid)}`, {
    method: "DELETE",
  });
}

export async function groupsLeave(groupId) {
  return apiFetch(`/api/groups/${encodeURIComponent(groupId)}/leave`, { method: "DELETE" });
}

export async function groupsListMessages(groupId, params) {
  const q = new URLSearchParams();
  if (params?.before) {
    q.set("before", params.before);
  }
  if (params?.limit) {
    q.set("limit", String(params.limit));
  }
  const s = q.toString();
  return apiFetch(`/api/groups/${encodeURIComponent(groupId)}/messages${s ? `?${s}` : ""}`);
}

export async function groupsPostMessage(groupId, text) {
  return apiFetch(`/api/groups/${encodeURIComponent(groupId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

/** @param {string} groupId @param {string} url */
export async function groupsAddPlayerQueue(groupId, url) {
  return apiFetch(`/api/groups/${encodeURIComponent(groupId)}/player/queue`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
