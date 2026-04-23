import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchPresenceCount } from "../../lib/api";
import { setOnlineCount } from "../../app/roomSlice";
import { addToast } from "../../app/uiSlice";
import { useSessionSocket } from "../../hooks/useSessionSocket";
import { useStrangerCall } from "../../hooks/useStrangerCall";
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
          addToast({ type: "warning", message: "Your match skipped to the next person. Your chat and call ended." })
        );
      } else if (reason === "peer-disconnected") {
        dispatch(
          addToast({ type: "warning", message: "Your match disconnected. The call and chat were closed." })
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
    videoEnabled,
    startSearch,
    stopSearch,
    next,
    sendMessage,
    toggleVideo,
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

  return (
    <div className={styles.wrap}>
      <header className={styles.top}>
        <h1 className={styles.roomTitle}>Match</h1>
        <div className={styles.badge} title="Users currently connected to this app">
          <span>Online</span> <strong>{online}</strong>
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
        <button
          type="button"
          className={videoEnabled ? styles.secondary : styles.videoOff}
          onClick={toggleVideo}
          disabled={!inQueue && !inCall}
          aria-pressed={videoEnabled}
          title={videoEnabled ? "Turn camera off" : "Turn camera on"}
        >
          {videoEnabled ? "Video on" : "Video off"}
        </button>
      </div>

      <div className={styles.videos}>
        <div>
          <p className={styles.label}>You</p>
          <video ref={localRef} className={styles.vid} playsInline autoPlay muted />
        </div>
        <div>
          <p className={styles.label}>Match</p>
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
