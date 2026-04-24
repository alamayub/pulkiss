import { useCallback, useEffect, useState, useRef } from "react";
import { useDispatch } from "react-redux";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  groupsGet,
  groupsJoinRequest,
  groupsAcceptRequest,
  groupsRejectRequest,
  groupsRemoveMember,
  groupsLeave,
  groupsCloseGroup,
  groupsListMessages,
  groupsPostMessage,
} from "../../lib/api";
import { addToast } from "../../app/uiSlice";
import { useSessionSocket } from "../../hooks/useSessionSocket";
import { GroupYouTubePlayer } from "../../components/GroupYouTubePlayer/GroupYouTubePlayer";
import styles from "./GroupDetailPage.module.scss";

/** @param {string | undefined} name @param {string} uid */
function memberInitials(name, uid) {
  const s = (name || "").trim();
  if (s.length >= 2) {
    return (s[0] + s[s.length - 1]).toUpperCase();
  }
  if (s.length === 1) {
    return s[0].toUpperCase();
  }
  return (uid || "?").slice(0, 2).toUpperCase();
}

function BackArrowIcon() {
  return (
    <svg className={styles.backIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * @param {{ user: { uid: string } }} props
 */
export function GroupDetailPage({ user }) {
  const dispatch = useDispatch();
  const { groupId } = useParams();
  const nav = useNavigate();
  const { socket } = useSessionSocket(user?.uid);
  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgErr, setMsgErr] = useState("");
  const logRef = useRef(null);
  const ignoreNextDisbandedRef = useRef(false);

  const loadDetail = useCallback(async () => {
    if (!groupId) {
      return;
    }
    setErr("");
    try {
      const d = await groupsGet(groupId);
      setDetail(d);
    } catch (e) {
      if (e.status === 404) {
        setErr("Group not found");
      } else {
        setErr(e.data?.error || e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadMessages = useCallback(async () => {
    if (!groupId || !detail?.isMember) {
      return;
    }
    try {
      const r = await groupsListMessages(groupId, { limit: 50 });
      const chrono = [...(r.messages || [])].reverse();
      setMessages(chrono);
    } catch {
      // ignore
    }
  }, [groupId, detail?.isMember]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const detailGroupId = detail?.group?.id;

  /**
   * Refresh group detail (members, join requests for admins, pending state for you) on an interval
   * so the page matches the server without a manual refresh. `detailGroupId` (not `detail`) keeps the
   * interval from resetting on every successful load.
   */
  useEffect(() => {
    if (!groupId || !detailGroupId) {
      return undefined;
    }
    const t = setInterval(() => {
      void loadDetail();
    }, 8000);
    return () => clearInterval(t);
  }, [groupId, detailGroupId, loadDetail]);

  useEffect(() => {
    if (!detail?.isMember) {
      return undefined;
    }
    void loadMessages();
    const t = setInterval(() => void loadMessages(), 5000);
    return () => clearInterval(t);
  }, [loadMessages, detail?.isMember]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  const onJoin = async () => {
    setErr("");
    try {
      await groupsJoinRequest(groupId);
      setDetail((prev) => (prev ? { ...prev, hasPendingRequest: true } : prev));
      await loadDetail();
    } catch (e) {
      setErr(e.data?.error || e.message);
    }
  };

  const accept = async (uid) => {
    setErr("");
    try {
      await groupsAcceptRequest(groupId, uid);
      await loadDetail();
    } catch (e) {
      setErr(e.data?.error || e.message);
    }
  };

  const reject = async (uid) => {
    setErr("");
    try {
      await groupsRejectRequest(groupId, uid);
      await loadDetail();
    } catch (e) {
      setErr(e.data?.error || e.message);
    }
  };

  const remove = async (uid) => {
    if (!window.confirm("Remove this member?")) {
      return;
    }
    setErr("");
    try {
      await groupsRemoveMember(groupId, uid);
      await loadDetail();
    } catch (e) {
      setErr(e.data?.error || e.message);
    }
  };

  const onLeave = async () => {
    if (!window.confirm("Leave this group?")) {
      return;
    }
    setErr("");
    try {
      const r = await groupsLeave(groupId);
      if (r.groupDeleted) {
        nav("/groups");
        return;
      }
      await loadDetail();
    } catch (e) {
      setErr(e.data?.error || e.message);
    }
  };

  const onCloseGroup = async () => {
    if (
      !window.confirm(
        "Close this group? It will be removed for you and all members, and the chat and watch data will be deleted on the server."
      )
    ) {
      return;
    }
    setErr("");
    try {
      ignoreNextDisbandedRef.current = true;
      setTimeout(() => {
        ignoreNextDisbandedRef.current = false;
      }, 3000);
      await groupsCloseGroup(groupId);
      dispatch(
        addToast({ type: "success", message: "Group closed." })
      );
      nav("/groups");
    } catch (e) {
      setErr(e.data?.error || e.message);
    }
  };

  useEffect(() => {
    if (!socket || !groupId) {
      return undefined;
    }
    const onDisbanded = (/** @type {{ groupId?: string } | null} */ payload) => {
      if (!payload || String(payload.groupId) !== String(groupId)) {
        return;
      }
      if (ignoreNextDisbandedRef.current) {
        return;
      }
      dispatch(
        addToast({
          type: "warning",
          message: "The group was closed by an admin. You are back on the list.",
        })
      );
      nav("/groups", { replace: true });
    };
    socket.on("group:disbanded", onDisbanded);
    return () => {
      socket.off("group:disbanded", onDisbanded);
    };
  }, [socket, groupId, nav, dispatch]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) {
      return;
    }
    setMsgErr("");
    try {
      await groupsPostMessage(groupId, t);
      setText("");
      await loadMessages();
    } catch (e) {
      setMsgErr(e.data?.error || e.message);
    }
  };

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.pageLoading} role="status">
          <div className={styles.loadingDots} aria-hidden>
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </div>
          <span>Loading group…</span>
        </div>
      </div>
    );
  }
  if (err && !detail) {
    return (
      <div className={styles.wrap}>
        <div className={styles.pageError}>
          <p className={styles.err}>{err}</p>
          <Link to="/groups" className={styles.back}>
            <BackArrowIcon />
            All groups
          </Link>
        </div>
      </div>
    );
  }
  if (!detail) {
    return null;
  }

  const g = detail.group;
  const d = detail;

  return (
    <div className={styles.wrap}>
      {err ? <p className={styles.err}>{err}</p> : null}

      <section className={styles.card}>
        <div className={styles.groupHead}>
          <div className={styles.groupHeadMain}>
            <h1 className={styles.title}>{g.name}</h1>
            {g.description ? <p className={styles.desc}>{g.description}</p> : null}
          </div>
          <Link to="/groups" className={styles.back}>
            <BackArrowIcon />
            All groups
          </Link>
        </div>
        <div className={styles.memTop}>
          <div className={styles.cardHeadRow}>
            <h2 className={styles.cardTitle}>Members ({d.members?.length || 0})</h2>
            <div className={styles.cardHeadActions}>
              {!d.isMember && !d.hasPendingRequest ? (
                <button type="button" className={styles.primary} onClick={() => void onJoin()}>
                  Request to join
                </button>
              ) : null}
              {!d.isMember && d.hasPendingRequest ? (
                <p className={styles.pendingInline}>Your request is pending admin approval.</p>
              ) : null}
              {d.isMember ? (
                <p className={styles.badgeIn}>
                  You’re a member
                  {d.isAdmin ? " · Admin" : ""}
                </p>
              ) : null}
              {d.isMember && d.isAdmin ? (
                <button type="button" className={styles.danger} onClick={() => void onCloseGroup()}>
                  Close group
                </button>
              ) : null}
              {d.isMember && !d.isAdmin ? (
                <button type="button" className={styles.danger} onClick={() => void onLeave()}>
                  Leave group
                </button>
              ) : null}
            </div>
          </div>
          {d.isAdmin && d.joinRequests?.length > 0 ? (
            <>
              <h3 className={styles.cardSubTitle}>Join requests</h3>
              <ul className={styles.reqList}>
                {d.joinRequests.map((r) => (
                  <li key={r.uid} className={styles.reqItem}>
                    <span className={styles.reqName}>{r.name || r.uid}</span>
                    <div className={styles.reqActions}>
                      <button type="button" className={styles.small} onClick={() => void accept(r.uid)}>
                        Accept
                      </button>
                      <button type="button" className={styles.smallMuted} onClick={() => void reject(r.uid)}>
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <ul className={styles.memList}>
          {d.members?.map((m) => (
            <li key={m.uid} className={styles.memRow}>
              <span className={styles.memAvatar} aria-hidden>
                {memberInitials(m.name, m.uid)}
              </span>
              <div className={styles.memMain}>
                <span className={styles.memName}>{m.name}</span>
                {m.role === "admin" ? <span className={styles.adminBadge}>Admin</span> : null}
              </div>
              {d.isAdmin && m.uid !== user?.uid ? (
                <button type="button" className={styles.linkBtn} onClick={() => void remove(m.uid)}>
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {d.isMember ? (
        <section className={styles.card}>
          <GroupYouTubePlayer
            key={groupId}
            groupId={groupId}
            socket={socket}
            isAdmin={!!d.isAdmin}
            initialPlayer={d.player}
            user={user}
          />
        </section>
      ) : null}

      {d.isMember ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Chat</h2>
          {msgErr ? <p className={styles.err}>{msgErr}</p> : null}
          <div className={styles.chatLog} ref={logRef}>
            {messages.map((m) => {
              const mine = m.fromUid === user?.uid;
              return (
                <div key={m.id} className={`${styles.msg} ${mine ? styles.msgMine : styles.msgThem}`}>
                  <div className={styles.msgBubble}>
                    <span className={styles.msgAuthor}>{m.fromName}</span>
                    <p className={styles.msgText}>{m.text}</p>
                    <time className={styles.msgAt} dateTime={m.createdAt || undefined}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
                    </time>
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={send} className={styles.chatForm}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="Message the group…"
            />
            <button type="submit" className={styles.primary} disabled={!text.trim()}>
              Send
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
