import { randomUUID } from "node:crypto";
import { avatarUrlForUid } from "../lib/peerAvatarUrl.js";
import { verifyIdToken } from "../lib/firebaseAdmin.js";
import { registerConnection, unregisterConnection } from "../lib/onlineRegistry.js";
import * as presence from "../lib/presence.js";
import {
  getGroupPlayerStateSnapshot,
  getRole,
  runGroupPlayerAdminCommand,
} from "../lib/groupsStore.js";
import { emitGroupPlayerState } from "../lib/groupPlayerBroadcast.js";

/**
 * @param {import("socket.io").Server} io
 */
function initSocket(io) {
  const queue = [];
  const inQueue = new Set();
  /** @type {Map<string, { a: { socketId: string, uid: string }, b: { socketId: string, uid: string } }>} */
  const matches = new Map();
  /** @type {Map<string, string>} */
  const uidToMatchId = new Map();

  function getPeerSocketId(match, socketId) {
    if (match.a.socketId === socketId) {
      return match.b.socketId;
    }
    if (match.b.socketId === socketId) {
      return match.a.socketId;
    }
    return null;
  }

  function getPeerEntry(match, socketId) {
    if (match.a.socketId === socketId) {
      return match.b;
    }
    if (match.b.socketId === socketId) {
      return match.a;
    }
    return null;
  }

  function removeFromQueue(socketId) {
    const i = queue.indexOf(socketId);
    if (i >= 0) {
      queue.splice(i, 1);
    }
    inQueue.delete(socketId);
  }

  function endMatchBySocket(socketId, reason) {
    const s = io.sockets.sockets.get(socketId);
    if (!s || !s.data) {
      return;
    }
    const mid = s.data.matchId;
    if (!mid) {
      return;
    }
    const m = matches.get(mid);
    if (!m) {
      return;
    }
    const peerId = getPeerSocketId(m, socketId);
    matches.delete(mid);
    for (const sk of [m.a.socketId, m.b.socketId]) {
      const sock = io.sockets.sockets.get(sk);
      if (sock) {
        sock.data.matchId = undefined;
        sock.data.inMatch = false;
        void uidToMatchId.delete(sock.data.uid);
      }
    }
    if (peerId) {
      io.to(peerId).emit("match:ended", { reason: reason || "left" });
    }
  }

  function tryMatch() {
    while (queue.length >= 2) {
      const socketA = queue.shift();
      const socketB = queue.shift();
      inQueue.delete(socketA);
      inQueue.delete(socketB);
      const a = io.sockets.sockets.get(socketA);
      const b = io.sockets.sockets.get(socketB);
      if (!a || !a.data) {
        if (b) {
          queue.unshift(socketB);
        }
        inQueue.add(socketB);
        continue;
      }
      if (!b || !b.data) {
        if (a) {
          queue.unshift(socketA);
        }
        inQueue.add(socketA);
        continue;
      }
      if (a.data.uid === b.data.uid) {
        queue.unshift(socketA);
        inQueue.add(socketA);
        queue.push(socketB);
        inQueue.add(socketB);
        continue;
      }
      const matchId = randomUUID();
      const m = {
        a: { socketId: socketA, uid: a.data.uid },
        b: { socketId: socketB, uid: b.data.uid },
      };
      matches.set(matchId, m);
      a.data.matchId = matchId;
      b.data.matchId = matchId;
      a.data.inMatch = true;
      b.data.inMatch = true;
      uidToMatchId.set(m.a.uid, matchId);
      uidToMatchId.set(m.b.uid, matchId);
      const aSelfUrl = avatarUrlForUid(a.data.uid);
      const bSelfUrl = avatarUrlForUid(b.data.uid);
      a.emit("match:found", {
        matchId,
        peerSocketId: b.id,
        peerUid: b.data.uid,
        selfAvatarUrl: aSelfUrl,
        peerAvatarUrl: bSelfUrl,
        isInitiator: true,
      });
      b.emit("match:found", {
        matchId,
        peerSocketId: a.id,
        peerUid: a.data.uid,
        selfAvatarUrl: bSelfUrl,
        peerAvatarUrl: aSelfUrl,
        isInitiator: false,
      });
    }
  }

  async function onConnection(socket) {
    // Register disconnect before any await. If the client closes the tab while
    // verifyIdToken is in flight, disconnect still runs; otherwise we can mark
    // them online after the socket is already gone and never unregister.
    socket.on("disconnect", () => {
      const uid = socket.data.uid;
      if (uid) {
        unregisterConnection(uid);
      }
      removeFromQueue(socket.id);
      const mid = socket.data.matchId;
      if (mid) {
        const m = matches.get(mid);
        if (m) {
          const peerId = getPeerSocketId(m, socket.id);
          matches.delete(mid);
          for (const entry of [m.a, m.b]) {
            const sk = entry.socketId;
            const s2 = io.sockets.sockets.get(sk);
            if (s2) {
              s2.data.matchId = undefined;
              s2.data.inMatch = false;
              void uidToMatchId.delete(s2.data.uid);
            }
          }
          if (peerId) {
            io.to(peerId).emit("match:ended", { reason: "peer-disconnected" });
          }
        }
      }
      if (socket.data.presenceCounted) {
        socket.data.presenceCounted = false;
        presence.decrement();
        io.emit("presence:count", presence.get());
      }
    });

    try {
      const token =
        (socket.handshake.auth && socket.handshake.auth.token) ||
        (socket.handshake.query && String(socket.handshake.query.token)) ||
        (socket.handshake.headers.authorization &&
          String(socket.handshake.headers.authorization).replace(/^Bearer\s+/i, "")) ||
        "";
      if (!token) {
        const err = new Error("unauthorized");
        // @ts-ignore
        err.data = { code: "UNAUTHORIZED" };
        throw err;
      }
      const decoded = await verifyIdToken(token);
      if (!decoded.uid) {
        const err = new Error("unauthorized");
        // @ts-ignore
        err.data = { code: "UNAUTHORIZED" };
        throw err;
      }
      if (!socket.connected) {
        return;
      }
      socket.data.uid = decoded.uid;
      registerConnection(decoded);
      socket.join(`user:${decoded.uid}`);
      presence.increment();
      socket.data.presenceCounted = true;
      io.emit("presence:count", presence.get());
      const uidForAvatar = decoded.uid;
      setImmediate(() => {
        if (socket.connected) {
          socket.emit("session:self", { selfAvatarUrl: avatarUrlForUid(uidForAvatar) });
        }
      });
    } catch (e) {
      console.warn("Socket auth failed", e.message);
      return socket.disconnect(true);
    }

    socket.on("queue:join", () => {
      if (socket.data.inMatch) {
        return;
      }
      if (inQueue.has(socket.id)) {
        return;
      }
      if (uidToMatchId.has(socket.data.uid)) {
        return;
      }
      socket.emit("session:self", { selfAvatarUrl: avatarUrlForUid(socket.data.uid) });
      queue.push(socket.id);
      inQueue.add(socket.id);
      tryMatch();
    });

    socket.on("queue:leave", () => {
      removeFromQueue(socket.id);
    });

    socket.on("match:next", () => {
      const mid = socket.data.matchId;
      if (!mid) {
        return;
      }
      const m = matches.get(mid);
      if (!m) {
        return;
      }
      const peerId = getPeerSocketId(m, socket.id);
      if (m) {
        for (const sk of [m.a.socketId, m.b.socketId]) {
          const sock = io.sockets.sockets.get(sk);
          if (sock) {
            sock.data.inMatch = false;
            void uidToMatchId.delete(sock.data.uid);
            sock.data.matchId = undefined;
          }
        }
        matches.delete(mid);
      }
      if (peerId) {
        io.to(peerId).emit("match:ended", { reason: "next" });
      }
    });

    function validateInMatch(incomingMatchId) {
      const m = matches.get(incomingMatchId);
      if (!m) {
        return null;
      }
      const okA = m.a.socketId === socket.id || m.b.socketId === socket.id;
      if (!okA) {
        return null;
      }
      return m;
    }

    socket.on("rtc:offer", (payload) => {
      if (!payload || !payload.matchId) {
        return;
      }
      const m = validateInMatch(String(payload.matchId));
      if (!m) {
        return;
      }
      const target = getPeerEntry(m, socket.id);
      if (!target) {
        return;
      }
      const peer = io.sockets.sockets.get(target.socketId);
      if (!peer) {
        return;
      }
      peer.emit("rtc:offer", { matchId: payload.matchId, sdp: payload.sdp, from: socket.id });
    });

    socket.on("rtc:answer", (payload) => {
      if (!payload || !payload.matchId) {
        return;
      }
      const m = validateInMatch(String(payload.matchId));
      if (!m) {
        return;
      }
      const target = getPeerEntry(m, socket.id);
      if (!target) {
        return;
      }
      const peer = io.sockets.sockets.get(target.socketId);
      if (!peer) {
        return;
      }
      peer.emit("rtc:answer", { matchId: payload.matchId, sdp: payload.sdp, from: socket.id });
    });

    socket.on("rtc:ice", (payload) => {
      if (!payload || !payload.matchId) {
        return;
      }
      const m = validateInMatch(String(payload.matchId));
      if (!m) {
        return;
      }
      const target = getPeerEntry(m, socket.id);
      if (!target) {
        return;
      }
      const peer = io.sockets.sockets.get(target.socketId);
      if (!peer) {
        return;
      }
      peer.emit("rtc:ice", {
        matchId: payload.matchId,
        candidate: payload.candidate,
        from: socket.id,
      });
    });

    socket.on("chat:message", (payload) => {
      const text = payload && payload.text;
      if (typeof text !== "string") {
        return;
      }
      const trimmed = text.slice(0, 2000);
      if (!trimmed) {
        return;
      }
      if (!socket.data.matchId) {
        return;
      }
      const m = validateInMatch(String(socket.data.matchId));
      if (!m) {
        return;
      }
      const target = getPeerEntry(m, socket.id);
      if (!target) {
        return;
      }
      io.to(target.socketId).emit("chat:message", { text: trimmed, from: socket.id });
    });

    socket.on("group:player:subscribe", (payload) => {
      const groupId = payload && payload.groupId != null && String(payload.groupId);
      if (!groupId) {
        return;
      }
      if (!getRole(groupId, socket.data.uid)) {
        return;
      }
      socket.join(`groupPlayer:${groupId}`);
      const st = getGroupPlayerStateSnapshot(groupId);
      if (st) {
        socket.emit("group:player:state", st);
      }
    });

    socket.on("group:player:unsubscribe", (payload) => {
      const groupId = payload && payload.groupId != null && String(payload.groupId);
      if (groupId) {
        socket.leave(`groupPlayer:${groupId}`);
      }
    });

    socket.on("group:player:command", (payload) => {
      if (!payload || payload.groupId == null) {
        return;
      }
      const groupId = String(payload.groupId);
      const action = typeof payload.action === "string" ? payload.action : "";
      if (!action) {
        return;
      }
      if (!getRole(groupId, socket.data.uid)) {
        return;
      }
      const r = runGroupPlayerAdminCommand(groupId, action, payload, socket.data.uid);
      if (r.error) {
        socket.emit("group:player:error", { error: r.error, groupId });
        return;
      }
      emitGroupPlayerState(groupId);
    });
  }

  io.on("connection", (socket) => {
    onConnection(socket).catch((e) => {
      console.error("socket connect error", e);
      try {
        socket.disconnect(true);
      } catch {
        // ignore
      }
    });
  });
}

export { initSocket };
