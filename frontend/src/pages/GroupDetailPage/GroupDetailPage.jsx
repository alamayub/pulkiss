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

/** @param {{ url: string, imgClassName?: string }} props */
function GroupHeaderLogo({ url, imgClassName }) {
  const [hide, setHide] = useState(false);
  if (!url || hide) {
    return null;
  }
  return (
    <img
      src={url}
      alt=""
      className={imgClassName || styles.overviewLogo}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setHide(true)}
    />
  );
}

/** @param {string | undefined} iso */
function formatRelativeShort(iso) {
  if (!iso) {
    return "";
  }
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) {
    return "";
  }
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) {
    return "just now";
  }
  const m = Math.floor(sec / 60);
  if (m < 60) {
    return `${m}m ago`;
  }
  const h = Math.floor(m / 60);
  if (h < 48) {
    return `${h}h ago`;
  }
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** @param {string | undefined} iso */
function formatMsgTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
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

function IconInvite() {
  return (
    <svg className={styles.menuIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className={styles.headerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg className={styles.headerIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className={styles.iconMini} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className={styles.iconMini} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @param {{
 *   styles: Record<string, string>,
 *   messages: Array<{ id: string, fromUid: string, fromName: string, text: string, createdAt?: string }>,
 *   user: { uid?: string } | null | undefined,
 *   msgErr: string,
 *   text: string,
 *   setText: (s: string) => void,
 *   send: (e: import("react").FormEvent) => void | Promise<void>,
 *   logRef: React.RefObject<HTMLDivElement | null>,
 *   disabled: boolean,
 *   variant?: "page" | "aside",
 * }} props
 */
function GroupChatPanel({ styles: s, messages, user, msgErr, text, setText, send, logRef, disabled, variant = "page" }) {
  const root = variant === "aside" ? s.chatAside : s.chatCard;
  return (
    <div className={root}>
      <div className={s.chatCardHead}>Chat</div>
      {msgErr ? <p className={s.errInline}>{msgErr}</p> : null}
      <div className={s.chatScroll} ref={logRef}>
        {messages.map((m) => {
          const mine = m.fromUid === user?.uid;
          return (
            <div key={m.id} className={`${s.msgRow} ${mine ? s.msgSelf : ""}`}>
              <div className={s.msgAvatar}>
                <span className={s.msgAvatarLetter}>{memberInitials(m.fromName, m.fromUid)}</span>
              </div>
              <div className={s.msgBody}>
                <div className={s.msgMeta}>
                  <span className={s.msgName}>{m.fromName}</span>
                  <time className={s.msgTime} dateTime={m.createdAt || undefined}>
                    {m.createdAt ? formatMsgTime(m.createdAt) : ""}
                  </time>
                </div>
                <div className={s.msgBubble}>{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form
        className={s.chatComposer}
        onSubmit={(e) => {
          void send(e);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="Type a message…"
          disabled={disabled}
          aria-label="Chat message"
        />
        <button type="button" className={s.emojiBtn} disabled={disabled} aria-label="Emoji" tabIndex={-1}>
          <span aria-hidden>☺</span>
        </button>
        <button type="submit" className={s.sendFab} disabled={disabled || !text.trim()} aria-label="Send message">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </form>
    </div>
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
  const [tab, setTab] = useState(/** @type {"overview" | "chat" | "members" | "requests" | "player"} */ ("overview"));
  const [moreOpen, setMoreOpen] = useState(false);
  const logRef = useRef(null);
  const moreWrapRef = useRef(null);
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
  }, [messages, tab]);

  const isMember = !!detail?.isMember;
  const isAdmin = !!detail?.isAdmin;
  useEffect(() => {
    if (!detail) {
      return;
    }
    if (!isMember && (tab === "chat" || tab === "player")) {
      setTab("overview");
    }
    if (!isAdmin && tab === "requests") {
      setTab("overview");
    }
  }, [detail, isMember, isAdmin, tab]);

  useEffect(() => {
    if (!moreOpen) {
      return undefined;
    }
    const onDoc = (e) => {
      const el = moreWrapRef.current;
      if (el && !el.contains(/** @type {Node} */ (e.target))) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

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
    setMoreOpen(false);
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
    setMoreOpen(false);
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
      dispatch(addToast({ type: "success", message: "Group closed." }));
      nav("/groups");
    } catch (e) {
      setErr(e.data?.error || e.message);
    }
  };

  const onInvite = useCallback(async () => {
    setMoreOpen(false);
    const url = `${window.location.origin}/groups/${groupId}`;
    try {
      await navigator.clipboard.writeText(url);
      dispatch(addToast({ type: "success", message: "Group link copied to clipboard." }));
    } catch {
      dispatch(
        addToast({
          type: "warning",
          message: `Could not copy automatically. Share: ${url}`,
        })
      );
    }
  }, [dispatch, groupId]);

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
          <Link to="/groups" className={styles.backLink}>
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
  const creator = d.members?.find((m) => m.uid === g.createdBy);
  const creatorName = creator?.name || g.createdBy || "Unknown";
  const adminMember = d.members?.find((m) => m.role === "admin");
  const adminName = adminMember?.name || "—";
  const createdDate =
    g.createdAt != null
      ? new Date(g.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "";
  const memberCount = d.members?.length || 0;
  const requestCount = d.isAdmin ? d.joinRequests?.length || 0 : 0;

  /** @type {Array<{ id: typeof tab; label: string; badge?: number }>} */
  const tabs = [{ id: "overview", label: "Overview" }];
  if (d.isMember) {
    tabs.push({ id: "chat", label: "Chat" });
  }
  tabs.push({ id: "members", label: "Members", badge: memberCount });
  if (d.isAdmin) {
    tabs.push({ id: "requests", label: "Requests", badge: requestCount });
  }
  if (d.isMember) {
    tabs.push({ id: "player", label: "Player" });
  }

  return (
    <div className={styles.wrap}>
      {err && <p className={styles.errBanner}>{err}</p>}

      <nav className={styles.tabs} role="tablist" aria-label="Group sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
            {t.badge != null ? (
              <span className={t.badge > 0 && t.id === "requests" ? styles.tabBadgeAlert : styles.tabBadge} aria-hidden>
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className={styles.body}>
        {tab === "overview" && (
          <div className={styles.overviewStack}>
            <section className={styles.overviewHero} aria-labelledby="group-overview-title">
              <div className={styles.overviewHeroBar}>
                <Link to="/groups" className={styles.backCircle} title="Back to groups" aria-label="Back to groups">
                  <BackArrowIcon />
                </Link>
                <div className={styles.overviewHeroActions}>
                  <div className={styles.overviewHeroActionsScroll}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => {
                        if (d.isAdmin) {
                          setTab("requests");
                        } else {
                          dispatch(addToast({ type: "info", message: "No group alerts right now." }));
                        }
                      }}
                      aria-label={d.isAdmin ? `Join requests${requestCount ? `, ${requestCount} pending` : ""}` : "Notifications"}
                    >
                      <IconBell />
                      {d.isAdmin && requestCount > 0 ? (
                        <span className={styles.notifBadge}>{requestCount > 99 ? "99+" : requestCount}</span>
                      ) : null}
                    </button>

                    {!d.isMember && !d.hasPendingRequest && (
                      <button type="button" className={styles.btnPrimarySm} onClick={() => void onJoin()}>
                        Request to join
                      </button>
                    )}
                    {!d.isMember && d.hasPendingRequest && <span className={styles.pendingTag}>Pending</span>}
                  </div>

                  <div className={styles.moreWrap} ref={moreWrapRef}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-expanded={moreOpen}
                      aria-haspopup="true"
                      aria-label="More options"
                      onClick={() => setMoreOpen((v) => !v)}
                    >
                      <IconMore />
                    </button>
                    {moreOpen && (
                      <div className={styles.moreMenu} role="menu">
                        {d.isMember ? (
                          <>
                            <button type="button" className={styles.moreItem} role="menuitem" onClick={() => void onInvite()}>
                              <IconInvite />
                              Invite members
                            </button>
                            <button type="button" className={styles.moreItem} role="menuitem" onClick={() => void onLeave()}>
                              Leave group
                            </button>
                            {d.isAdmin ? (
                              <button type="button" className={styles.moreItemDanger} role="menuitem" onClick={() => void onCloseGroup()}>
                                Delete group
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <Link to="/groups" className={styles.moreItem} role="menuitem" onClick={() => setMoreOpen(false)}>
                            All groups
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.overviewHeroRow}>
                {g.logoUrl && <GroupHeaderLogo url={g.logoUrl} imgClassName={styles.overviewLogo} />}
                <div className={styles.overviewHeroText}>
                  <h1 id="group-overview-title" className={styles.overviewTitle}>
                    {g.name}
                  </h1>
                  <p className={styles.overviewSub}>
                    {memberCount} {memberCount === 1 ? "member" : "members"}
                    <span className={styles.metaSep}> · </span>
                    Admin: {adminName}
                  </p>
                  <p className={styles.overviewMeta}>
                    Created {createdDate || "—"}
                    <span className={styles.metaSep}> · </span>
                    Created by {creatorName}
                  </p>
                  {!d.isMember ? (
                    <p className={styles.overviewMembership}>
                      {d.hasPendingRequest
                        ? "Your join request is pending admin approval."
                        : "You’re not a member yet — use Request to join at the top of this card."}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <div className={styles.overviewGrid}>
              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>About</h2>
                <p className={styles.panelBody}>{g.description || "No description yet."}</p>
              </section>

            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Group activity</h2>
              {d.isAdmin && d.joinRequests?.length > 0 ? (
                <ul className={styles.activityList}>
                  {d.joinRequests.slice(0, 4).map((r) => (
                    <li key={r.uid} className={styles.activityRow}>
                      <span className={styles.activityAvatar} aria-hidden>
                        {memberInitials(r.name, r.uid)}
                      </span>
                      <div className={styles.activityMain}>
                        <span className={styles.activityText}>
                          <strong>{r.name || r.uid}</strong> requested to join
                        </span>
                        <span className={styles.activityTime}>{formatRelativeShort(r.requestedAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.panelMuted}>
                  {d.isMember ? "No pending join requests right now." : "Join the group to see updates here."}
                </p>
              )}
              {d.isAdmin && requestCount > 0 && (
                <button type="button" className={styles.linkish} onClick={() => setTab("requests")}>
                  View all requests
                </button>
              )}
            </section>

            {d.isAdmin && (
              <section className={`${styles.panel} ${styles.adminPanel}`}>
                <h2 className={styles.panelTitle}>Admin controls</h2>
                <div className={styles.adminBtnGrid}>
                  <button type="button" className={styles.adminBtn} onClick={() => setTab("members")}>
                    Manage members
                  </button>
                  <button
                    type="button"
                    className={styles.adminBtn}
                    onClick={() => dispatch(addToast({ type: "info", message: "Group settings are coming soon." }))}
                  >
                    Group settings
                  </button>
                  <button type="button" className={styles.adminBtn} onClick={() => setTab("requests")}>
                    Manage requests
                    {requestCount > 0 ? <span className={styles.inlineBadge}>{requestCount}</span> : null}
                  </button>
                  <button type="button" className={styles.adminBtnDanger} onClick={() => void onCloseGroup()}>
                    Delete group
                  </button>
                </div>
              </section>
            )}
            </div>
          </div>
        )}

        {tab === "members" && (
          <section className={styles.tabSection}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Members</h2>
              <span className={styles.countBadge}>{memberCount}</span>
              {d.isMember ? (
                <button type="button" className={styles.inviteChip} onClick={() => void onInvite()}>
                  <IconInvite />
                  Invite
                </button>
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
                    {m.role === "admin" ? (
                      <span className={styles.adminBadge}>Admin</span>
                    ) : (
                      <span className={styles.memberBadge}>Member</span>
                    )}
                  </div>
                  {d.isAdmin && m.uid !== user?.uid ? (
                    <button type="button" className={styles.linkBtn} onClick={() => void remove(m.uid)}>
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {memberCount > 8 ? (
              <p className={styles.mutedFoot}>Showing all {memberCount} members.</p>
            ) : null}
          </section>
        )}

        {tab === "requests" && d.isAdmin && (
          <section className={styles.tabSection}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Join requests</h2>
              <span className={styles.countBadge}>{requestCount}</span>
            </div>
            {d.joinRequests?.length > 0 ? (
              <ul className={styles.reqList}>
                {d.joinRequests.map((r) => (
                  <li key={r.uid} className={styles.reqItem}>
                    <div className={styles.reqMain}>
                      <span className={styles.reqAvatar} aria-hidden>
                        {memberInitials(r.name, r.uid)}
                      </span>
                      <div>
                        <span className={styles.reqName}>{r.name || r.uid}</span>
                        <span className={styles.reqSub}>Requested {formatRelativeShort(r.requestedAt)}</span>
                      </div>
                    </div>
                    <div className={styles.reqActions}>
                      <button type="button" className={styles.iconAccept} title="Accept" onClick={() => void accept(r.uid)} aria-label="Accept">
                        <IconCheck />
                      </button>
                      <button type="button" className={styles.iconDecline} title="Decline" onClick={() => void reject(r.uid)} aria-label="Decline">
                        <IconX />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.panelMuted}>No pending requests.</p>
            )}
          </section>
        )}

        {tab === "chat" && d.isMember && (
          <section className={styles.tabSection}>
            <GroupChatPanel
              styles={styles}
              messages={messages}
              user={user}
              msgErr={msgErr}
              text={text}
              setText={setText}
              send={send}
              logRef={logRef}
              disabled={!d.isMember}
              variant="page"
            />
          </section>
        )}

        {tab === "player" && d.isMember && (
          <div className={styles.playerDashboard}>
            <div className={styles.dashPlayer}>
              <div className={styles.dashCard}>
                <GroupYouTubePlayer
                  key={groupId}
                  groupId={groupId}
                  socket={socket}
                  isAdmin={!!d.isAdmin}
                  initialPlayer={d.player}
                  user={user}
                  layout="dashboard"
                />
              </div>
            </div>

            <aside className={styles.dashChat}>
              <GroupChatPanel
                styles={styles}
                messages={messages}
                user={user}
                msgErr={msgErr}
                text={text}
                setText={setText}
                send={send}
                logRef={logRef}
                disabled={!d.isMember}
                variant="aside"
              />
            </aside>

            <div className={styles.dashBottom}>
              <section className={styles.previewCard}>
                <div className={styles.previewHead}>
                  <h2 className={styles.previewTitle}>Members</h2>
                  <span className={styles.countBadgeMuted}>{memberCount}</span>
                  <button type="button" className={styles.inviteChip} onClick={() => void onInvite()}>
                    <IconInvite />
                    Invite
                  </button>
                </div>
                <ul className={styles.previewList}>
                  {(d.members || []).slice(0, 5).map((m) => (
                    <li key={m.uid} className={styles.previewRow}>
                      <span className={styles.previewAvatar} aria-hidden>
                        {memberInitials(m.name, m.uid)}
                      </span>
                      <span className={styles.previewName}>{m.name}</span>
                      {m.role === "admin" ? <span className={styles.adminTxt}>Admin</span> : <span className={styles.memberTxt}>Member</span>}
                    </li>
                  ))}
                </ul>
                <button type="button" className={styles.previewLink} onClick={() => setTab("members")}>
                  View all members
                </button>
              </section>

              {d.isAdmin ? (
                <section className={styles.previewCard}>
                  <div className={styles.previewHead}>
                    <h2 className={styles.previewTitle}>Join requests</h2>
                    <span className={styles.countBadgeMuted}>{requestCount}</span>
                  </div>
                  {d.joinRequests?.length > 0 ? (
                    <>
                      <ul className={styles.previewList}>
                        {d.joinRequests.slice(0, 3).map((r) => (
                          <li key={r.uid} className={styles.previewReqRow}>
                            <span className={styles.previewAvatar} aria-hidden>
                              {memberInitials(r.name, r.uid)}
                            </span>
                            <div className={styles.previewReqMain}>
                              <span className={styles.previewName}>{r.name || r.uid}</span>
                              <span className={styles.reqSubInline}>Requested {formatRelativeShort(r.requestedAt)}</span>
                            </div>
                            <div className={styles.previewReqActions}>
                              <button type="button" className={styles.iconAccept} onClick={() => void accept(r.uid)} aria-label="Accept">
                                <IconCheck />
                              </button>
                              <button type="button" className={styles.iconDecline} onClick={() => void reject(r.uid)} aria-label="Decline">
                                <IconX />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <button type="button" className={styles.previewLink} onClick={() => setTab("requests")}>
                        View all requests
                      </button>
                    </>
                  ) : (
                    <p className={styles.panelMuted}>No pending requests.</p>
                  )}
                </section>
              ) : (
                <section className={styles.previewCardMuted}>
                  <p className={styles.panelMuted}>Join requests are visible to group admins.</p>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
