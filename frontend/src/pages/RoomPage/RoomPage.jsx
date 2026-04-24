import { useCallback, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { addToast } from "../../app/uiSlice";
import { useSessionSocket } from "../../hooks/useSessionSocket";
import { useStrangerCall } from "../../hooks/useStrangerCall";
import { useVideoCenterAvatar } from "../../hooks/useVideoCenterAvatar";
import styles from "./RoomPage.module.scss";

function ControlIcon({ children }) {
  return (
    <svg
      className={styles.ctrlIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IconStart() {
  return (
    <ControlIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.5 8.5L15.5 12l-5 3.5v-7z" fill="currentColor" stroke="none" />
    </ControlIcon>
  );
}

function IconStop() {
  return (
    <ControlIcon>
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </ControlIcon>
  );
}

function IconNext() {
  return (
    <ControlIcon>
      <path d="M3 4v16l8.5-8L3 4z" fill="currentColor" stroke="none" />
      <path d="M12.5 4v16L21 12l-8.5-8z" fill="currentColor" stroke="none" />
    </ControlIcon>
  );
}

function IconVideo() {
  return (
    <ControlIcon>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l5-2.5V16.5L16 14v-4z" fill="currentColor" stroke="none" />
    </ControlIcon>
  );
}

function IconVideoOff() {
  return (
    <ControlIcon>
      <line x1="1" y1="1" x2="23" y2="23" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l4-2v2.2M7 3.5a4.5 4.5 0 0 0-4.5 4.5" />
    </ControlIcon>
  );
}

function IconMic() {
  return (
    <ControlIcon>
      <path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </ControlIcon>
  );
}

function IconMicOff() {
  return (
    <ControlIcon>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M12 1a3 3 0 0 0-3 3v3.2M8 5a4.5 4.5 0 0 0 7 0" />
      <path d="M19 10v1a7 7 0 0 1-11.6 5.1M12 19v4" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </ControlIcon>
  );
}

/**
 * @param {{ user: { uid: string, email?: string | null, displayName?: string | null, phoneNumber?: string | null, photoURL?: string | null } }} props
 */
export function RoomPage({ user }) {
  const dispatch = useDispatch();
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
    audioEnabled,
    remoteCameraOn,
    selfAvatarUrl,
    peerAvatarUrl,
    startSearch,
    stopSearch,
    next,
    sendMessage,
    toggleVideo,
    toggleAudio,
  } = useStrangerCall(socket, localRef, remoteRef, { onMatchEnd });
  const [chatInput, setChatInput] = useState("");

  const localShowCenterAvatar = useVideoCenterAvatar(localRef, videoEnabled, true);
  const remoteShowCenterAvatar = useVideoCenterAvatar(remoteRef, remoteCameraOn, inCall);

  return (
    <div className={styles.wrap}>

      <div className={styles.videos}>
        <p className={styles.status} role="status" aria-live="polite">
          {searchStatus}
        </p>
        <div className={styles.matchStage}>
          <p className={styles.labelMatch}>Match</p>
          <div className={styles.videoShell}>
            <video ref={remoteRef} className={styles.vidRemote} playsInline autoPlay />
            {inCall && peerAvatarUrl ? (
              <>
                {remoteShowCenterAvatar ? (
                  <div className={styles.avatarFallback} aria-hidden>
                    <img src={peerAvatarUrl} alt="" className={styles.avatarHero} decoding="async" />
                  </div>
                ) : null}
                <div className={styles.avatarCorner} aria-hidden>
                  <img src={peerAvatarUrl} alt="" className={styles.avatarCornerImg} decoding="async" />
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div className={styles.pip}>
          <p className={styles.pipLabel}>You</p>
          <div className={styles.videoShell}>
            <video ref={localRef} className={styles.vidPip} playsInline autoPlay muted />
            {selfAvatarUrl ? (
              <>
                {localShowCenterAvatar ? (
                  <div className={styles.avatarFallback} aria-hidden>
                    <img src={selfAvatarUrl} alt="" className={styles.avatarHero} decoding="async" />
                  </div>
                ) : null}
                <div className={`${styles.avatarCorner} ${styles.avatarCornerPip}`} aria-hidden>
                  <img src={selfAvatarUrl} alt="" className={styles.avatarCornerImg} decoding="async" />
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div className={styles.callControls} role="toolbar" aria-label="Call controls">
          <button
            type="button"
            className={styles.iconBtnPrimary}
            onClick={() => void startSearch()}
            disabled={!socket?.connected || inQueue || inCall}
            data-tooltip="Start matching"
            aria-label="Start matching"
          >
            <IconStart />
          </button>
          <button
            type="button"
            className={styles.iconBtnNeutral}
            onClick={stopSearch}
            disabled={!inQueue}
            data-tooltip="Stop search"
            aria-label="Stop search"
          >
            <IconStop />
          </button>
          <button
            type="button"
            className={styles.iconBtnDanger}
            onClick={next}
            disabled={!inCall}
            data-tooltip="Skip to next match"
            aria-label="Next match"
          >
            <IconNext />
          </button>
          <button
            type="button"
            className={videoEnabled ? styles.iconBtnNeutral : styles.iconBtnOff}
            onClick={toggleVideo}
            disabled={!inQueue && !inCall}
            aria-pressed={videoEnabled}
            data-tooltip={videoEnabled ? "Turn camera off" : "Turn camera on"}
            aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
          >
            {videoEnabled ? <IconVideo /> : <IconVideoOff />}
          </button>
          <button
            type="button"
            className={audioEnabled ? styles.iconBtnNeutral : styles.iconBtnOff}
            onClick={toggleAudio}
            disabled={!inQueue && !inCall}
            aria-pressed={audioEnabled}
            data-tooltip={audioEnabled ? "Mute microphone" : "Unmute microphone"}
            aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {audioEnabled ? <IconMic /> : <IconMicOff />}
          </button>
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
