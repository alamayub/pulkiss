import { getGroupAdminUids } from "./groupsStore.js";

/** @type {import("socket.io").Server | null} */
let _io = null;

/**
 * @param {string[]} uids
 * @param {string} event
 * @param {Record<string, unknown>} payload
 */
function emitToUsers(uids, event, payload) {
  if (!_io) {
    return;
  }
  for (const uid of uids) {
    _io.to(`user:${uid}`).emit(event, payload);
  }
}

/** @param {import("socket.io").Server} io */
export function setGroupJoinNotifyIo(io) {
  _io = io;
}

/**
 * Notify group admins (connected sockets) that someone requested to join.
 * @param {{ groupId: string, groupName: string, requesterUid: string, requesterName: string }} p
 */
export function emitGroupJoinRequestToAdmins(p) {
  if (!_io) {
    return;
  }
  const adminUids = getGroupAdminUids(p.groupId);
  const payload = {
    groupId: p.groupId,
    groupName: p.groupName,
    requesterUid: p.requesterUid,
    requesterName: p.requesterName,
  };
  for (const uid of adminUids) {
    if (uid === p.requesterUid) {
      continue;
    }
    _io.to(`user:${uid}`).emit("group:join-request", payload);
  }
}

/**
 * Notify the user whose join request was accepted or rejected.
 * @param {{ targetUid: string, groupId: string, groupName: string, outcome: "accepted" | "rejected" }} p
 */
export function emitGroupJoinDecisionToRequester(p) {
  if (!_io) {
    return;
  }
  _io.to(`user:${p.targetUid}`).emit("group:join-decision", {
    groupId: p.groupId,
    groupName: p.groupName,
    outcome: p.outcome,
  });
}

/**
 * Notify remaining members that someone left voluntarily.
 * @param {{ groupId: string, groupName: string, leaverUid: string, leaverName: string, remainingMemberUids: string[] }} p
 */
export function emitGroupMemberLeftToMembers(p) {
  const payload = {
    groupId: p.groupId,
    groupName: p.groupName,
    leaverUid: p.leaverUid,
    leaverName: p.leaverName,
  };
  emitToUsers(p.remainingMemberUids, "group:member-left", payload);
}
