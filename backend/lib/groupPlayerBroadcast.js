import { getGroupPlayerStateSnapshot } from "./groupsStore.js";

/** @type {import("socket.io").Server | null} */
let _io = null;

/**
 * @param {import("socket.io").Server} io
 */
export function setGroupPlayerIo(io) {
  _io = io;
}

const roomName = (groupId) => `groupPlayer:${groupId}`;

/**
 * @param {string} groupId
 */
export function emitGroupPlayerState(groupId) {
  if (!_io) {
    return;
  }
  const st = getGroupPlayerStateSnapshot(groupId);
  if (st) {
    _io.to(roomName(groupId)).emit("group:player:state", st);
  }
}

/**
 * Notify all clients who joined the group player room that the group no longer exists
 * (e.g. admin closed the group). Safe to call after the group is deleted in memory.
 * @param {string} groupId
 */
export function emitGroupDisbanded(groupId) {
  if (!_io) {
    return;
  }
  _io.to(roomName(groupId)).emit("group:disbanded", { groupId: String(groupId) });
}
