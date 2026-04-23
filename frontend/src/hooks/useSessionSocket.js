import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getFirebaseAuth } from "../lib/firebase";
import { getSocketUrl } from "../lib/socketUrl";
import { store } from "../app/store";
import { addToast } from "../app/uiSlice";

/** @type {{ socket: import("socket.io-client").Socket | null, uid: string | null, n: number }} */
const st = { socket: null, uid: null, n: 0 };

/** @type {Promise<void> | null} */
let creating = null;

function onGroupJoinRequestToast(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const name = typeof payload.requesterName === "string" ? payload.requesterName.trim() : "";
  const groupName = typeof payload.groupName === "string" ? payload.groupName.trim() : "your group";
  const who = name || "Someone";
  store.dispatch(
    addToast({
      type: "info",
      message: `${who} wants to join “${groupName}”. Open the group to accept or decline.`,
    })
  );
}

function onGroupJoinDecisionToast(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const groupName = typeof payload.groupName === "string" ? payload.groupName.trim() : "the group";
  const outcome = payload.outcome === "accepted" ? "accepted" : payload.outcome === "rejected" ? "rejected" : null;
  if (!outcome) {
    return;
  }
  const msg =
    outcome === "accepted"
      ? `You were accepted into “${groupName}”. Open the group to chat.`
      : `Your request to join “${groupName}” was declined.`;
  store.dispatch(
    addToast({
      type: outcome === "accepted" ? "success" : "warning",
      message: msg,
    })
  );
}

function onGroupMemberLeftToast(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const groupName = typeof payload.groupName === "string" ? payload.groupName.trim() : "the group";
  const leaverName = typeof payload.leaverName === "string" ? payload.leaverName.trim() : "Someone";
  const who = leaverName || "Someone";
  store.dispatch(
    addToast({
      type: "info",
      message: `${who} left “${groupName}”.`,
    })
  );
}

/** @param {import("socket.io-client").Socket} s */
function attachGroupNotifyListeners(s) {
  s.off("group:join-request", onGroupJoinRequestToast);
  s.off("group:join-decision", onGroupJoinDecisionToast);
  s.off("group:member-left", onGroupMemberLeftToast);
  s.on("group:join-request", onGroupJoinRequestToast);
  s.on("group:join-decision", onGroupJoinDecisionToast);
  s.on("group:member-left", onGroupMemberLeftToast);
}

function detachGroupNotifyListeners() {
  if (st.socket) {
    st.socket.off("group:join-request", onGroupJoinRequestToast);
    st.socket.off("group:join-decision", onGroupJoinDecisionToast);
    st.socket.off("group:member-left", onGroupMemberLeftToast);
  }
}

function teardownIfIdle() {
  if (st.n > 0) {
    return;
  }
  detachGroupNotifyListeners();
  if (st.socket) {
    st.socket.disconnect();
    st.socket = null;
  }
  st.uid = null;
}

/**
 * @param {string} uid
 */
function startConnect(uid) {
  if (creating) {
    return creating;
  }
  creating = (async () => {
    try {
      detachGroupNotifyListeners();
      if (st.socket) {
        st.socket.disconnect();
        st.socket = null;
      }
      st.uid = null;

      const auth = getFirebaseAuth();
      const u = auth.currentUser;
      if (!u || u.uid !== uid) {
        throw new Error("Not signed in");
      }
      const token = await u.getIdToken();
      const s = io(getSocketUrl(), {
        path: "/socket.io",
        auth: { token },
        withCredentials: true,
      });
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Socket connect timeout")), 20000);
        s.once("connect", () => {
          clearTimeout(t);
          resolve(undefined);
        });
        s.once("connect_error", (err) => {
          clearTimeout(t);
          reject(err);
        });
      });
      st.socket = s;
      st.uid = uid;
      attachGroupNotifyListeners(s);
      if (st.n <= 0) {
        detachGroupNotifyListeners();
        s.disconnect();
        st.socket = null;
        st.uid = null;
      }
    } finally {
      creating = null;
    }
  })();
  return creating;
}

/**
 * Socket.io client authenticated with Firebase ID token (shared across hook instances for the same session).
 * @param {string | null | undefined} uid
 */
export function useSessionSocket(uid) {
  const [socket, setSocket] = useState(/** @type {import("socket.io-client").Socket | null} */ (null));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setSocket(null);
      setError(null);
      return undefined;
    }

    st.n += 1;

    const syncSocketToState = () => {
      if (st.socket && st.uid === uid) {
        setSocket(st.socket);
        setError(null);
      }
    };

    if (st.socket && st.uid === uid) {
      attachGroupNotifyListeners(st.socket);
      syncSocketToState();
    } else {
      void startConnect(uid)
        .then(() => {
          syncSocketToState();
        })
        .catch((e) => {
          setError(e);
          setSocket(null);
        });
    }

    return () => {
      st.n -= 1;
      setSocket(null);
      teardownIfIdle();
    };
  }, [uid]);

  return { socket, error };
}
