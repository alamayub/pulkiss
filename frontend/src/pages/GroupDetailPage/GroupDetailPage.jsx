import { useCallback, useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  groupsGet,
  groupsJoinRequest,
  groupsAcceptRequest,
  groupsRejectRequest,
  groupsRemoveMember,
  groupsLeave,
  groupsListMessages,
  groupsPostMessage,
} from "../../lib/api";
import { useSessionSocket } from "../../hooks/useSessionSocket";
import { GroupYouTubePlayer } from "../../components/GroupYouTubePlayer/GroupYouTubePlayer";
import styles from "./GroupDetailPage.module.scss";

/**
 * @param {{ user: { uid: string } }} props
 */
export function GroupDetailPage({ user }) {
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
    return <p className={styles.wrap}>Loading…</p>;
  }
  if (err && !detail) {
    return (
      <div className={styles.wrap}>
        <p className={styles.err}>{err}</p>
        <Link to="/groups">Back to groups</Link>
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
      <header className={styles.top}>
        <div>
          <h1>{g.name}</h1>
          {g.description && <p className={styles.desc}>{g.description}</p>}
        </div>
        <Link to="/groups" className={styles.back}>
          All groups
        </Link>
      </header>
      {err && <p className={styles.err}>{err}</p>}

      <section className={styles.card}>
        <h2>Membership</h2>
        {d.isMember && (
          <p className={styles.badgeIn}>
            You are a member
            {d.isAdmin && " (admin)"}
          </p>
        )}
        {!d.isMember && !d.hasPendingRequest && (
          <button type="button" className={styles.primary} onClick={() => void onJoin()}>
            Request to join
          </button>
        )}
        {!d.isMember && d.hasPendingRequest && <p className={styles.muted}>Your request is pending admin approval.</p>}
        {d.isMember && (
          <button type="button" className={styles.danger} onClick={() => void onLeave()}>
            Leave group
          </button>
        )}
      </section>

      {d.isAdmin && d.joinRequests?.length > 0 && (
        <section className={styles.card}>
          <h2>Join requests</h2>
          <ul className={styles.reqList}>
            {d.joinRequests.map((r) => (
              <li key={r.uid} className={styles.reqItem}>
                <span>{r.name || r.uid}</span>
                <div>
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
        </section>
      )}

      {d.isMember && (
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
      )}

      <section className={styles.card}>
        <h2>Members ({d.members?.length || 0})</h2>
        <ul className={styles.memList}>
          {d.members?.map((m) => (
            <li key={m.uid}>
              {m.name} {m.role === "admin" && <em>(admin)</em>}
              {d.isAdmin && m.uid !== user?.uid && (
                <button type="button" className={styles.linkBtn} onClick={() => void remove(m.uid)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {d.isMember && (
        <section className={styles.card}>
          <h2>Chat</h2>
          {msgErr && <p className={styles.err}>{msgErr}</p>}
          <div className={styles.chatLog} ref={logRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.fromUid === user?.uid ? styles.mine : styles.them}
              >
                <span className={styles.from}>{m.fromName}:</span> {m.text}
                <div className={styles.at}>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</div>
              </div>
            ))}
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
      )}
    </div>
  );
}
