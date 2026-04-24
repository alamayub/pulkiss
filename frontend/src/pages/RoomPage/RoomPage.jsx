import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { addToast } from "../../app/uiSlice";
import { useSessionSocket } from "../../hooks/useSessionSocket";
import { useStrangerCall } from "../../hooks/useStrangerCall";
import { useVideoCenterAvatar } from "../../hooks/useVideoCenterAvatar";
import styles from "./RoomPage.module.scss";

/** @param {number} totalSec */
function formatCallDurationHMS(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMsgTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function ControlIcon({ children, className }) {
  return (
    <svg
      className={className || styles.ctrlIcon}
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

function IconShield() {
  return (
    <ControlIcon className={styles.headerIcon}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

function IconChat() {
  return (
    <ControlIcon>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </ControlIcon>
  );
}

function IconEndCall() {
  return (
    <ControlIcon>
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.42 12.11 12.11 0 0 0 7.58-.45 2 2 0 0 1 1.51 1.84 2 2 0 0 1-.48 1.45l-2.35 2.35a16 16 0 0 1-22.61 0 16 16 0 0 1 0-22.61l2.35-2.35a2 2 0 0 1 1.45-.48 2 2 0 0 1 1.84 1.51 12.11 12.11 0 0 0 .45 7.58 2 2 0 0 1-.42 2.11l-1.27 1.27a16 16 0 0 0 2.6 3.41" />
    </ControlIcon>
  );
}

function IconNextArrow() {
  return (
    <svg className={styles.nextArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlayStart() {
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

function IconExpand() {
  return (
    <ControlIcon>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </ControlIcon>
  );
}

function IconCompressFs() {
  return (
    <ControlIcon>
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
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
  const chatInputRef = useRef(null);
  const videoShellRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const { socket } = useSessionSocket(user?.uid);
  const [panelTab, setPanelTab] = useState(/** @type {"chat" | "info"} */ ("chat"));
  const [callSeconds, setCallSeconds] = useState(0);

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
      } else if (reason === "left") {
        dispatch(addToast({ type: "warning", message: "Your match ended the call." }));
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
    peerUid,
    startSearch,
    stopSearch,
    next,
    endSession,
    sendMessage,
    toggleVideo,
    toggleAudio,
  } = useStrangerCall(socket, localRef, remoteRef, { onMatchEnd });
  const [chatInput, setChatInput] = useState("");
  const [inFullscreen, setInFullscreen] = useState(false);

  const localShowCenterAvatar = useVideoCenterAvatar(localRef, videoEnabled, true);
  const remoteShowCenterAvatar = useVideoCenterAvatar(remoteRef, remoteCameraOn, inCall);

  const sessionActive = inQueue || inCall;
  const callTimerSeconds = sessionActive ? (inCall ? callSeconds : 0) : 0;

  useEffect(() => {
    if (!inCall) {
      setCallSeconds(0);
      return undefined;
    }
    const id = window.setInterval(() => setCallSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [inCall]);

  const focusChat = useCallback(() => {
    setPanelTab("chat");
    window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const sync = () => {
      const doc = document;
      setInFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = videoShellRef.current;
    if (!el) return;
    const doc = document;
    try {
      const active = doc.fullscreenElement || doc.webkitFullscreenElement;
      if (!active) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (/** @type {HTMLElement & { webkitRequestFullscreen?: () => void }} */ (el).webkitRequestFullscreen) {
          /** @type {HTMLElement & { webkitRequestFullscreen: () => void }} */ (el).webkitRequestFullscreen();
        } else {
          throw new Error("no-fs");
        }
      } else if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } catch {
      dispatch(addToast({ type: "info", message: "Fullscreen is not available in this browser." }));
    }
  }, [dispatch]);

  return (
    <div className={styles.wrap}>
      <div className={styles.roomActions}>
        {!sessionActive && (
          <>
            <p className={styles.actionsHint}>Ready to meet someone new? Allow your camera and microphone, then start.</p>
            <button
              type="button"
              className={styles.btnStart}
              onClick={() => void startSearch()}
              disabled={!socket?.connected || inQueue || inCall}
            >
              <IconPlayStart />
              <span>Start matching</span>
            </button>
          </>
        )}
        {inQueue && !inCall && (
          <>
            <p className={styles.actionsHint}>{searchStatus}</p>
            <button type="button" className={styles.btnStop} onClick={stopSearch}>
              <IconStop />
              <span>Stop search</span>
            </button>
          </>
        )}
        {inCall && (
          <>
            <p className={styles.actionsHint}>Looking for someone new? Skip when you are ready for the next person.</p>
            <button type="button" className={styles.btnNext} onClick={next} disabled={!inCall}>
              <span>Next</span>
              <IconNextArrow />
            </button>
          </>
        )}
      </div>

      <div className={styles.roomGrid}>
        <section className={styles.stage}>
          <div className={styles.videoShell} ref={videoShellRef}>
            {sessionActive && (
              <div
                className={styles.callTimer}
                role="timer"
                aria-live="off"
                aria-label={`Call duration ${formatCallDurationHMS(callTimerSeconds)}`}
              >
                <span className={styles.callTimerDot} aria-hidden />
                {formatCallDurationHMS(callTimerSeconds)}
              </div>
            )}

            <div className={styles.matchStage}>
              <div className={styles.remoteWrap}>
                <video ref={remoteRef} className={styles.vidRemote} playsInline autoPlay />
                {inCall && peerAvatarUrl && (
                  <>
                    {remoteShowCenterAvatar && (
                      <div className={styles.avatarFallback} aria-hidden>
                        <img src={peerAvatarUrl} alt="" className={styles.avatarHero} decoding="async" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className={styles.pip}>
              <div className={styles.pipSignal} aria-hidden title="Camera on" />
              <div className={styles.pipInner}>
                <video ref={localRef} className={styles.vidPip} playsInline autoPlay muted />
                {selfAvatarUrl && (
                  <>
                    {localShowCenterAvatar && (
                      <div className={styles.avatarFallback} aria-hidden>
                        <img src={selfAvatarUrl} alt="" className={styles.avatarHero} decoding="async" />
                      </div>
                    )}
                    <div className={`${styles.avatarCorner} ${styles.avatarCornerPip}`} aria-hidden>
                      <img src={selfAvatarUrl} alt="" className={styles.avatarCornerImg} decoding="async" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {sessionActive && (
              <div className={styles.callDock} role="toolbar" aria-label="Call controls">
                <div className={styles.dockItem}>
                  <button
                    type="button"
                    className={videoEnabled ? styles.dockRound : `${styles.dockRound} ${styles.dockRoundOff}`}
                    onClick={toggleVideo}
                    disabled={!sessionActive}
                    aria-pressed={videoEnabled}
                    aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
                  >
                    {videoEnabled ? <IconVideo /> : <IconVideoOff />}
                  </button>
                  <span className={styles.dockLabel} aria-hidden>
                    Camera
                  </span>
                </div>
                <div className={styles.dockItem}>
                  <button
                    type="button"
                    className={audioEnabled ? styles.dockRound : `${styles.dockRound} ${styles.dockRoundOff}`}
                    onClick={toggleAudio}
                    disabled={!sessionActive}
                    aria-pressed={audioEnabled}
                    aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
                  >
                    {audioEnabled ? <IconMic /> : <IconMicOff />}
                  </button>
                  <span className={styles.dockLabel} aria-hidden>
                    Mic
                  </span>
                </div>
                <div className={styles.dockItem}>
                  <button type="button" className={styles.dockRound} onClick={focusChat} aria-label="Open chat">
                    <IconChat />
                  </button>
                  <span className={styles.dockLabel} aria-hidden>
                    Chat
                  </span>
                </div>
                <div className={styles.dockItem}>
                  <button
                    type="button"
                    className={styles.dockRound}
                    onClick={() => void toggleFullscreen()}
                    aria-label={inFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {inFullscreen ? <IconCompressFs /> : <IconExpand />}
                  </button>
                  <span className={styles.dockLabel} aria-hidden>
                    {inFullscreen ? "Exit" : "Full screen"}
                  </span>
                </div>
                <div className={styles.dockItem}>
                  <button
                    type="button"
                    className={`${styles.dockRound} ${styles.dockRoundEnd}`}
                    onClick={endSession}
                    disabled={!sessionActive}
                    aria-label="End call"
                  >
                    <IconEndCall />
                  </button>
                  <span className={styles.dockLabel} aria-hidden>
                    End Call
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.chatPanel}>
          <div className={styles.panelTabs} role="tablist" aria-label="Side panel">
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === "chat"}
              className={panelTab === "chat" ? styles.tabOn : styles.tabOff}
              onClick={() => setPanelTab("chat")}
            >
              Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === "info"}
              className={panelTab === "info" ? styles.tabOn : styles.tabOff}
              onClick={() => setPanelTab("info")}
            >
              Info
            </button>
          </div>

          {panelTab === "chat" ? (
            <div className={styles.chatTab}>
              <div className={styles.chatBanner}>
                <IconShield />
                <span>Be kind and respectful. Have fun!</span>
              </div>
              <div className={styles.chatScroll}>
                {chatLines.map((line, i) => (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    className={`${styles.msgRow}${line.self ? ` ${styles.msgSelf}` : ""}`}
                  >
                    <div className={styles.msgAvatar}>
                      {line.self ? (
                        selfAvatarUrl ? (
                          <img src={selfAvatarUrl} alt="" className={styles.msgAvatarImg} decoding="async" />
                        ) : (
                          <span className={styles.msgAvatarLetter}>Y</span>
                        )
                      ) : peerAvatarUrl ? (
                        <img src={peerAvatarUrl} alt="" className={styles.msgAvatarImg} decoding="async" />
                      ) : (
                        <span className={styles.msgAvatarLetter}>S</span>
                      )}
                    </div>
                    <div className={styles.msgBody}>
                      <div className={styles.msgMeta}>
                        <span className={styles.msgName}>{line.self ? "You" : "Stranger"}</span>
                        <time className={styles.msgTime} dateTime={new Date(line.at).toISOString()}>
                          {formatMsgTime(line.at)}
                        </time>
                      </div>
                      <div className={styles.msgBubble}>{line.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <form
                className={styles.chatComposer}
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(chatInput);
                  setChatInput("");
                }}
              >
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={2000}
                  placeholder="Type a message…"
                  disabled={!canChat}
                  aria-label="Chat message"
                />
                <button type="button" className={styles.emojiBtn} disabled={!canChat} aria-label="Emoji" tabIndex={-1}>
                  <span aria-hidden>☺</span>
                </button>
                <button type="submit" className={styles.sendFab} disabled={!canChat} aria-label="Send message">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              </form>
            </div>
          ) : (
            <div className={styles.infoTab}>
              {inCall && peerAvatarUrl ? (
                <div className={styles.infoCard}>
                  <img src={peerAvatarUrl} alt="" className={styles.infoHero} decoding="async" />
                  <h2 className={styles.infoTitle}>Your match</h2>
                  <p className={styles.infoMeta}>{peerUid ? `${peerUid.slice(0, 8)}…` : "Connected"}</p>
                </div>
              ) : (
                <div className={styles.infoCardMuted}>
                  <p className={styles.infoBlurb}>
                    Start a match to see your partner here. Media is peer-to-peer; chat goes through the server.
                  </p>
                </div>
              )}
              <p className={styles.infoFoot}>
                Configure <code>ICE_SERVERS</code> on the API for the best call quality when you deploy.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
