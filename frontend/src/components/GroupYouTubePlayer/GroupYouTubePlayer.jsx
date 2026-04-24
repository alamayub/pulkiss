import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { addToast } from "../../app/uiSlice";
import { groupsAddPlayerQueue, groupsGet } from "../../lib/api";
import { loadYouTubeIframeAPI } from "../../lib/youtubeApi";
import styles from "./GroupYouTubePlayer.module.scss";

const uid = () => `gyt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** @param {number} n */
function pad2(n) {
  return String(Math.floor(n)).padStart(2, "0");
}

/**
 * @param {number} s
 * @returns {string} `MM:SS`, or `HH:MM:SS` when an hour or more.
 */
function formatTime(s) {
  if (!Number.isFinite(s) || s < 0) {
    s = 0;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) {
    return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  }
  return `${pad2(m)}:${pad2(sec)}`;
}

function IconPlay() {
  return (
    <svg className={styles.adminIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72L17.5 12 8 5.14z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg className={styles.adminIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg className={styles.adminIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h12v12H6V6z" />
    </svg>
  );
}

function IconSkipNext() {
  return (
    <svg className={styles.adminIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 18l8.5-6L6 6v12zm10 0V6h2v12h-2z" />
    </svg>
  );
}

/**
 * @param {{ groupId: string, socket: import("socket.io-client").Socket | null, isAdmin: boolean, initialPlayer: object | null, user: { uid: string } | null }} props
 */
export function GroupYouTubePlayer({ groupId, socket, isAdmin, initialPlayer, user }) {
  const dispatch = useDispatch();
  const [playerData, setPlayerData] = useState(initialPlayer);
  const [url, setUrl] = useState("");
  const [localErr, setLocalErr] = useState("");
  const [yReady, setYReady] = useState(false);
  const [adding, setAdding] = useState(false);

  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubSec, setScrubSec] = useState(0);

  const playerRef = useRef(null);
  const domIdRef = useRef(uid());
  const lastVideoIdRef = useRef(/** @type {string | null} */ (null));
  const lastServerTimeRef = useRef(0);
  const isScrubbingRef = useRef(false);
  isScrubbingRef.current = isScrubbing;
  const rangeInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const durationRef = useRef(0);
  durationRef.current = durationSec;

  const cur = playerData?.current;
  const q = playerData?.queue || [];

  // Parent refreshes `initialPlayer` on an interval. Never overwrite newer socket/REST
  // state with a stale in-flight or cached HTTP response (older `serverTime`).
  useEffect(() => {
    if (initialPlayer == null) {
      return;
    }
    setPlayerData((prev) => {
      if (prev == null || prev.serverTime == null) {
        return initialPlayer;
      }
      if (initialPlayer.serverTime < prev.serverTime) {
        return prev;
      }
      return initialPlayer;
    });
  }, [groupId, initialPlayer]);

  useEffect(() => {
    if (!yReady || !playerData?.serverTime) {
      return;
    }
    if (playerData?.serverTime === lastServerTimeRef.current) {
      return;
    }
    lastServerTimeRef.current = playerData.serverTime;

    const y = playerRef.current;
    if (!y) {
      return;
    }
    const c = playerData.current;
    if (!c) {
      return;
    }
    if (!c?.videoId) {
      try {
        y.stopVideo();
      } catch {
        /* empty */
      }
      lastVideoIdRef.current = null;
      setCurrentSec(0);
      setDurationSec(0);
      return;
    }
    const pos = Math.max(0, Number(c.positionSec) || 0);
    const isNew = lastVideoIdRef.current !== c.videoId;
    if (isNew) {
      lastVideoIdRef.current = c.videoId;
      y.loadVideoById({
        videoId: c.videoId,
        startSeconds: pos,
      });
      setTimeout(() => {
        try {
          if (c.isPlaying) {
            y.playVideo();
          } else {
            y.pauseVideo();
          }
          if (typeof y.getDuration === "function") {
            const d = y.getDuration();
            if (d && Number.isFinite(d)) {
              setDurationSec(d);
            }
          }
          if (typeof y.getCurrentTime === "function" && !isScrubbingRef.current) {
            const t0 = y.getCurrentTime();
            if (Number.isFinite(t0)) {
              setCurrentSec(t0);
            }
          }
        } catch {
          /* empty */
        }
      }, 500);
    } else {
      try {
        y.seekTo(pos, true);
        if (c.isPlaying) {
          y.playVideo();
        } else {
          y.pauseVideo();
        }
        if (!isScrubbingRef.current) {
          setCurrentSec(pos);
        }
      } catch {
        /* empty */
      }
    }
  }, [playerData, yReady]);

  useEffect(() => {
    if (!yReady) {
      return undefined;
    }
    const tick = setInterval(() => {
      if (isScrubbingRef.current) {
        return;
      }
      const y = playerRef.current;
      if (!y || !cur?.videoId) {
        return;
      }
      try {
        if (typeof y.getCurrentTime === "function") {
          const ct = y.getCurrentTime();
          if (Number.isFinite(ct)) {
            setCurrentSec(ct);
          }
        }
        if (typeof y.getDuration === "function") {
          const d = y.getDuration();
          if (d && Number.isFinite(d) && d > 0) {
            setDurationSec(d);
          }
        }
      } catch {
        /* empty */
      }
    }, 250);
    return () => clearInterval(tick);
  }, [yReady, cur?.videoId]);

  useEffect(() => {
    if (!socket || !groupId || !user) {
      return undefined;
    }
    socket.emit("group:player:subscribe", { groupId });
    const onState = (st) => {
      if (st == null || st.serverTime == null) {
        return;
      }
      setPlayerData((prev) => {
        if (prev == null || prev.serverTime == null) {
          return st;
        }
        if (st.serverTime < prev.serverTime) {
          return prev;
        }
        return st;
      });
    };
    const onErr = (d) => {
      if (d?.groupId === groupId) {
        dispatch(
          addToast({ type: "error", message: d.error === "forbidden" ? "Not allowed" : d.error || "Player error" })
        );
      }
    };
    socket.on("group:player:state", onState);
    socket.on("group:player:error", onErr);
    return () => {
      socket.emit("group:player:unsubscribe", { groupId });
      socket.off("group:player:state", onState);
      socket.off("group:player:error", onErr);
    };
  }, [socket, groupId, user, dispatch]);

  const sendCmd = useCallback(
    (action, extra = {}) => {
      if (!socket?.connected) {
        dispatch(addToast({ type: "error", message: "Not connected to the server" }));
        return;
      }
      socket.emit("group:player:command", { groupId, action, ...extra });
    },
    [socket, groupId, dispatch]
  );

  const sendCmdRef = useRef(/** @type {((a: string, b?: object) => void) | null} */(null));
  const isAdminRef = useRef(/** @type {boolean} */ (false));
  const queueLengthRef = useRef(0);
  const lastVideoEndedAdvanceRef = useRef(0);
  sendCmdRef.current = sendCmd;
  isAdminRef.current = isAdmin;
  queueLengthRef.current = q.length;

  useEffect(() => {
    if (!groupId) {
      return undefined;
    }
    const id = domIdRef.current;
    let dead = false;

    (async () => {
      try {
        await loadYouTubeIframeAPI();
        if (dead || !window.YT) {
          return;
        }
        playerRef.current = new window.YT.Player(id, {
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            disablekb: 1,
          },
          events: {
            onReady: (ev) => {
              if (dead) {
                return;
              }
              setYReady(true);
              if (ev.target.getDuration) {
                const d = ev.target.getDuration();
                if (d && Number.isFinite(d) && d > 0) {
                  setDurationSec(d);
                }
              }
            },
            onStateChange: (e) => {
              if (!window.YT) {
                return;
              }
              if (e.data === window.YT.PlayerState.PLAYING) {
                const t = e.target;
                if (t.getDuration) {
                  const d = t.getDuration();
                  if (d && Number.isFinite(d) && d > 0) {
                    setDurationSec(d);
                  }
                }
                return;
              }
              if (e.data === window.YT.PlayerState.ENDED) {
                if (!isAdminRef.current) {
                  return;
                }
                if (queueLengthRef.current < 1) {
                  return;
                }
                const now = Date.now();
                if (now - lastVideoEndedAdvanceRef.current < 1200) {
                  return;
                }
                lastVideoEndedAdvanceRef.current = now;
                const sc = sendCmdRef.current;
                if (sc) {
                  sc("next");
                }
              }
            },
            onError: (e) => {
              setLocalErr("This video may not be embeddable. Try another link.");
              if ([2, 5, 100, 101, 150].includes(e.data)) {
                dispatch(
                  addToast({ type: "error", message: "This YouTube video cannot be played here. Try another link." })
                );
              }
            },
          },
        });
      } catch {
        if (!dead) {
          setLocalErr("Could not load the YouTube player.");
        }
      }
    })();

    return () => {
      dead = true;
      setYReady(false);
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        try {
          playerRef.current.destroy();
        } catch {
          /* empty */
        }
      }
      playerRef.current = null;
      lastVideoIdRef.current = null;
    };
  }, [groupId, dispatch]);

  const onAdd = async (e) => {
    e.preventDefault();
    const t = url.trim();
    if (!t) {
      return;
    }
    setLocalErr("");
    setAdding(true);
    try {
      await groupsAddPlayerQueue(groupId, t);
      setUrl("");
      const d = await groupsGet(groupId);
      if (d.player) {
        setPlayerData((prev) => {
          if (prev != null && prev.serverTime != null && d.player.serverTime < prev.serverTime) {
            return prev;
          }
          return d.player;
        });
        lastServerTimeRef.current = 0;
      }
    } catch (er) {
      setLocalErr(er.data?.error || er.message);
      dispatch(addToast({ type: "error", message: er.data?.error || er.message || "Add failed" }));
    } finally {
      setAdding(false);
    }
  };

  const onSeekBarPointerDown = useCallback(() => {
    if (!isAdmin) {
      return;
    }
    const y = playerRef.current;
    const t =
      y && typeof y.getCurrentTime === "function" && Number.isFinite(y.getCurrentTime()) ? y.getCurrentTime() : currentSec;
    setScrubSec(t);
    isScrubbingRef.current = true;
    setIsScrubbing(true);
  }, [isAdmin, currentSec]);

  const onSeekBarInput = useCallback(
    (e) => {
      if (!isAdmin) {
        return;
      }
      const v = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
      if (Number.isFinite(v)) {
        setScrubSec(v);
      }
    },
    [isAdmin]
  );

  const commitScrub = useCallback(() => {
    if (!isScrubbingRef.current) {
      return;
    }
    const el = rangeInputRef.current;
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    if (!el) {
      return;
    }
    const v = parseFloat(el.value);
    const maxD = parseFloat(el.max) || durationRef.current || v;
    if (!Number.isFinite(v)) {
      return;
    }
    const t = Math.max(0, Math.min(v, maxD));
    sendCmd("seek", { positionSec: t });
    setCurrentSec(t);
  }, [sendCmd]);

  useEffect(() => {
    if (!isScrubbing) {
      return undefined;
    }
    const onDocumentPointerUp = () => {
      commitScrub();
    };
    document.addEventListener("pointerup", onDocumentPointerUp, true);
    return () => {
      document.removeEventListener("pointerup", onDocumentPointerUp, true);
    };
  }, [isScrubbing, commitScrub]);

  const watchUrl = cur?.videoId ? `https://www.youtube.com/watch?v=${cur.videoId}` : null;
  const dMax = Math.max(0.01, durationSec || 0.01);
  const displayT = isScrubbing ? scrubSec : currentSec;
  const fillPct = dMax > 0 ? Math.min(100, Math.max(0, (displayT / dMax) * 100)) : 0;
  const showProgress = Boolean(cur?.videoId && (yReady || durationSec > 0));

  return (
    <div className={styles.root}>
      {cur?.isPlaying ? (
        <div className={styles.liveRow}>
          <span className={styles.badge}>Live</span>
        </div>
      ) : null}
      <p className={styles.muted}>
        {isAdmin
          ? "Add YouTube links. You control playback. Everyone in the group stays in sync with you."
          : "Only the group admin can control playback. Your player follows the admin in real time."}
      </p>
      {localErr && <p className={styles.err}>{localErr}</p>}

      <form className={styles.addRow} onSubmit={(e) => void onAdd(e)}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          placeholder="Paste a YouTube link…"
        />
        <button type="submit" disabled={adding || !url.trim()}>
          {adding ? "Adding…" : "Add to queue"}
        </button>
      </form>

      <div className={styles.playerWrap}>
        {!isAdmin && <div className={styles.iframeBlock} aria-hidden title="Server-controlled" />}
        <div className={styles.playerEl} id={domIdRef.current} />
      </div>

      {(showProgress || (isAdmin && yReady)) && (
        <div className={styles.controlRow}>
          {showProgress ? (
            <div className={styles.progressRow}>
              <span className={styles.tLeft}>{formatTime(displayT)}</span>
              <div className={styles.rangeWrap}>
                {isAdmin && yReady && cur?.videoId ? (
                  <input
                    ref={rangeInputRef}
                    type="range"
                    className={styles.range}
                    style={{ "--fill": `${fillPct}%` }}
                    min={0}
                    max={dMax}
                    step={0.1}
                    value={displayT}
                    onPointerDown={onSeekBarPointerDown}
                    onInput={onSeekBarInput}
                    onPointerCancel={commitScrub}
                    disabled={!cur?.videoId}
                    aria-label="Seek video by dragging"
                  />
                ) : (
                  <div className={styles.readonlyTrack} aria-hidden>
                    <div className={styles.readonlyFill} style={{ width: `${fillPct}%` }} />
                  </div>
                )}
              </div>
              <span className={styles.tRight}>{formatTime(durationSec)}</span>
            </div>
          ) : null}
          {isAdmin && yReady ? (
            <div className={styles.adminBar} role="toolbar" aria-label="Playback controls">
              <button
                type="button"
                className={styles.iconBtn}
                data-tooltip="Play"
                onClick={() => sendCmd("play")}
                disabled={!cur?.videoId}
                aria-label="Play"
              >
                <IconPlay />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                data-tooltip="Pause"
                onClick={() => sendCmd("pause")}
                disabled={!cur?.videoId}
                aria-label="Pause"
              >
                <IconPause />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                data-tooltip="Stop"
                onClick={() => sendCmd("stop")}
                aria-label="Stop"
              >
                <IconStop />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                data-tooltip="Next in queue"
                onClick={() => sendCmd("next")}
                disabled={!q.length}
                aria-label="Next in queue"
              >
                <IconSkipNext />
              </button>
            </div>
          ) : null}
        </div>
      )}

      {isAdmin && watchUrl && (
        <p className={styles.muted}>
          <a href={watchUrl} target="_blank" rel="noreferrer">
            Open on YouTube
          </a>
        </p>
      )}

      <ul className={styles.queue} aria-label="Video queue">
        {q.length === 0 && <li className={styles.muted}>No videos in the queue. Add a link above.</li>}
        {q.map((it) => (
          <li key={it.id} className={styles.qItem}>
            <span>
              {it.videoId}{" "}
              <span className={styles.qMeta}>({it.addedByName || it.addedByUid})</span>
              {it.id === cur?.currentItemId && <span className={styles.badge}>On air</span>}
            </span>
            {isAdmin && (
              <div className={styles.qActions}>
                <button type="button" onClick={() => sendCmd("setCurrent", { itemId: it.id })}>
                  Play this
                </button>
                <button type="button" className={styles.danger} onClick={() => sendCmd("remove", { itemId: it.id })}>
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
