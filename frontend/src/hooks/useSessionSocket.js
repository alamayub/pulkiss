import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getFirebaseAuth } from "../lib/firebase";
import { getSocketUrl } from "../lib/socketUrl";

/**
 * Socket.io client authenticated with Firebase ID token.
 * @param {string | null} uid
 */
export function useSessionSocket(uid) {
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setSocket(null);
      return undefined;
    }
    let active = true;
    let s = null;

    (async () => {
      try {
        const auth = getFirebaseAuth();
        const u = auth.currentUser;
        if (!u) {
          return;
        }
        const token = await u.getIdToken();
        if (!active) {
          return;
        }
        s = io(getSocketUrl(), {
          path: "/socket.io",
          auth: { token },
          withCredentials: true,
        });
        setSocket(s);
        setError(null);
      } catch (e) {
        setError(e);
      }
    })();

    return () => {
      active = false;
      if (s) {
        s.removeAllListeners();
        s.disconnect();
        s = null;
      }
      setSocket(null);
    };
  }, [uid]);

  return { socket, error };
}
