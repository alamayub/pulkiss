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
