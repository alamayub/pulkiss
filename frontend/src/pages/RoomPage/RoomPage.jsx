import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { fetchPresenceCount } from "../../lib/api";
import { setOnlineCount } from "../../app/roomSlice";
import { addToast } from "../../app/uiSlice";
import { useSessionSocket } from "../../hooks/useSessionSocket";
import { useStrangerCall } from "../../hooks/useStrangerCall";
import { isAdminEmail } from "../../lib/admin";
import styles from "./RoomPage.module.scss";

/**
 * @param {{ user: { uid: string, email?: string | null, displayName?: string | null, phoneNumber?: string | null, photoURL?: string | null } }} props
 */
export function RoomPage({ user }) {
  const dispatch = useDispatch();
  const online = useSelector((s) => s.room.onlineCount);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const { socket } = useSessionSocket(user?.uid);

  const onMatchEnd = useCallback(
    (evt) => {
      const reason = evt?.reason;
      if (reason === "next") {
        dispatch(
          addToast({ type: "warning", message: "Stranger skipped to the next person. Your chat and call ended." })
        );
      } else if (reason === "peer-disconnected") {
        dispatch(
          addToast({ type: "warning", message: "Stranger disconnected. The call and chat were closed." })
        );
      } else {
        dispatch(addToast({ type: "warning", message: "The call ended." }));
      }
    },
    [dispatch]
  );

  const {
    searchStatus,
    inQueue,
    inCall,
    canChat,
    chatLines,
    startSearch,
    stopSearch,
    next,
    sendMessage,
    endLocalMedia,
  } = useStrangerCall(socket, localRef, remoteRef, { onMatchEnd });
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    void fetchPresenceCount().then((c) => dispatch(setOnlineCount(c)));
  }, [dispatch]);

  useEffect(() => {
    if (!socket) return undefined;
    const onCount = (n) => {
      if (typeof n === "number") {
        dispatch(setOnlineCount(n));
      }
    };
    socket.on("connect", () => {
      void fetchPresenceCount().then((c) => dispatch(setOnlineCount(c)));
    });
    socket.on("presence:count", onCount);
    return () => {
      socket.off("presence:count", onCount);
    };
  }, [socket, dispatch]);

  const onLogout = async () => {
    if (socket?.connected) {
      socket.emit("queue:leave");
      socket.disconnect();
    }
    endLocalMedia();
    const auth = getFirebaseAuth();
    await signOut(auth);
  };

  const display =
    user.displayName ||
    user.email ||
    user.phoneNumber ||
    user.uid.slice(0, 8);

  return (
    <div className={styles.wrap}>
      <header className={styles.top}>
        <div>
          <h1>Stranger match</h1>
          <p className={styles.muted}>
            Signed in as <strong>{display}</strong>
          </p>
        </div>
        <div className={styles.topRight}>
          <Link to="/groups" className={styles.adminLink}>
            Groups
          </Link>
          {isAdminEmail(user) && (
            <Link to="/admin" className={styles.adminLink}>
              User admin
            </Link>
          )}
          <div className={styles.badge}>
            <span>Online</span> <strong>{online}</strong>
          </div>
        </div>
      </header>

      <p className={styles.status}>{searchStatus}</p>
      <div className={styles.tools}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => void startSearch()}
          disabled={!socket?.connected || inQueue || inCall}
        >
          Start
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={stopSearch}
          disabled={!inQueue}
        >
          Stop
        </button>
        <button type="button" className={styles.danger} onClick={next} disabled={!inCall}>
          Next
        </button>
        <button type="button" className={styles.secondary} onClick={() => void onLogout()}>
          Log out
        </button>
      </div>

      <div className={styles.videos}>
        <div>
          <p className={styles.label}>You</p>
          <video ref={localRef} className={styles.vid} playsInline autoPlay muted />
        </div>
        <div>
          <p className={styles.label}>Stranger</p>
          <video ref={remoteRef} className={styles.vid} playsInline autoPlay />
        </div>
      </div>

      <div className={styles.chat}>
        <div className={styles.chatLog}>
          {chatLines.map((line, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className={line.self ? styles.self : undefined}
            >
              {line.self ? "You: " : "Them: "}
              {line.text}
            </div>
          ))}
        </div>
        <form
          className={styles.chatForm}
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(chatInput);
            setChatInput("");
          }}
        >
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            maxLength={2000}
            placeholder="Type a message…"
            disabled={!canChat}
          />
          <button type="submit" className={styles.primary} disabled={!canChat}>
            Send
          </button>
        </form>
      </div>
      <p className={styles.foot}>
        Media is peer-to-peer. Chat is server-relayed. Configure <code>ICE_SERVERS</code> on the API
        and <code>Authentication</code> in Firebase (Google, email).
      </p>
    </div>
  );
}
