import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./GroupsListPage.module.scss";
import { groupsCreate, groupsList } from "../../lib/api";

/** @param {string} iso */
function formatListDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/** @param {string | undefined} uid */
function shortUid(uid) {
  if (!uid || typeof uid !== "string") return "—";
  return uid.length > 10 ? `${uid.slice(0, 8)}…` : uid;
}

/** @param {string} id */
function hueFromId(id) {
  let h = 216;
  for (let i = 0; i < id.length; i++) {
    h = (h * 33 + id.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/**
 * @param {{ logoUrl?: string | null, name: string, groupId: string }} props
 */
function GroupCardThumb({ logoUrl, name, groupId }) {
  const [broke, setBroke] = useState(false);
  const letter = (name || "?").trim().slice(0, 1).toUpperCase() || "?";
  const showImg = !!(logoUrl && !broke);
  return (
    <div className={styles.thumb} style={{ "--thumb-h": String(hueFromId(groupId)) }}>
      {showImg ? (
        <img
          src={logoUrl}
          alt=""
          className={styles.thumbImg}
          onError={() => setBroke(true)}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <span className={styles.thumbFallback} aria-hidden={showImg} style={{ display: showImg ? "none" : "flex" }}>
        {letter}
      </span>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg className={styles.itemChevron} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className={styles.primaryIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GroupsListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const openCreateModal = useCallback(() => {
    setCreateErr("");
    setCreateName("");
    setCreateDescription("");
    setCreateOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    if (createBusy) return;
    setCreateOpen(false);
  }, [createBusy]);

  useEffect(() => {
    if (location.state?.openCreate) {
      setCreateErr("");
      setCreateName("");
      setCreateDescription("");
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!createOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeCreateModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen, closeCreateModal]);

  const load = useCallback(async (opts = /** @type {{ silent?: boolean }} */ ({})) => {
    const silent = !!opts.silent;
    setErr("");
    if (!silent) {
      setLoading(true);
    }
    try {
      const r = await groupsList();
      setGroups(r.groups || []);
    } catch (e) {
      setErr(e.data?.error || e.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Keep the list in sync (e.g. after a join request on a group’s detail page) without a full page reload. */
  useEffect(() => {
    const t = setInterval(() => {
      void load({ silent: true });
    }, 10_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const submitCreate = async (e) => {
    e.preventDefault();
    setCreateErr("");
    setCreateBusy(true);
    const name = createName.trim();
    const description = createDescription.trim();
    try {
      const r = await groupsCreate({
        name,
        description: description || undefined,
      });
      if (r.group?.id) {
        setCreateOpen(false);
        navigate(`/groups/${r.group.id}`);
      }
    } catch (er) {
      setCreateErr(er.data?.error || er.message);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      {err ? <p className={styles.err}>{err}</p> : null}

      {loading && !groups.length ? (
        <div className={styles.loading} role="status">
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
          <span>Loading groups…</span>
        </div>
      ) : (
        <ul className={styles.list}>
          {groups.map((g) => (
            <li key={g.id}>
              <Link to={`/groups/${g.id}`} className={styles.item}>
                <GroupCardThumb logoUrl={g.logoUrl} name={g.name} groupId={g.id} />
                <div className={styles.itemMain}>
                  <div className={styles.itemTop}>
                    <h2 className={styles.itemTitle}>{g.name}</h2>
                    <ChevronRight />
                  </div>
                  {g.description ? (
                    <p className={styles.itemDesc}>{g.description}</p>
                  ) : (
                    <p className={styles.itemDescMuted}>No description yet.</p>
                  )}
                  <div className={styles.itemChips}>
                    {g.viewerRole === "admin" ? (
                      <span className={styles.chipAdmin}>You’re admin</span>
                    ) : null}
                    {g.isMember && g.viewerRole === "member" ? <span className={styles.chipMember}>Member</span> : null}
                    {!g.isMember && g.hasPendingRequest ? (
                      <span className={styles.chipPending}>Join request pending</span>
                    ) : null}
                    {!g.isMember && !g.hasPendingRequest ? <span className={styles.chipBrowse}>Not a member</span> : null}
                  </div>
                  <div className={styles.itemFoot}>
                    <span>
                      {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                    </span>
                    <span className={styles.dotSep} aria-hidden>
                      ·
                    </span>
                    <span>Since {formatListDate(g.createdAt)}</span>
                    <span className={styles.dotSep} aria-hidden>
                      ·
                    </span>
                    <span>Owner {shortUid(g.createdBy)}</span>
                    {(Number(g.watchQueueLength) > 0 || g.watchHasVideo) ? (
                      <>
                        <span className={styles.dotSep} aria-hidden>
                          ·
                        </span>
                        <span>
                          Watch queue {Number(g.watchQueueLength) || 0}
                          {g.watchHasVideo ? (g.watchIsPlaying ? " · Live" : " · Paused") : ""}
                        </span>
                      </>
                    ) : null}
                    {g.pendingJoinCount != null && g.pendingJoinCount > 0 ? (
                      <>
                        <span className={styles.dotSep} aria-hidden>
                          ·
                        </span>
                        <span className={styles.footRequests}>{g.pendingJoinCount} join requests</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {groups.length === 0 && !loading ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No groups yet</p>
          <p className={styles.emptyText}>Create a group to invite others by name, or ask an admin for an invite.</p>
          <button type="button" className={styles.emptyCta} onClick={openCreateModal}>
            <PlusIcon />
            Create your first group
          </button>
        </div>
      ) : null}

      {!createOpen ? (
        <button type="button" className={`${styles.primary} ${styles.createFab}`} onClick={openCreateModal}>
          <PlusIcon />
          <span>Create group</span>
        </button>
      ) : null}

      {createOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closeCreateModal();
          }}
        >
          <div
            className={styles.createModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="groups-create-title"
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <h2 id="groups-create-title" className={styles.modalTitle}>
              Create a group
            </h2>
            <p className={styles.modalIntro}>
              You’ll be the admin: approve join requests, remove members, and control watch-together playback. The server
              generates a logo from the group name.
            </p>

            {createErr ? <p className={styles.createErr}>{createErr}</p> : null}

            <form className={styles.createForm} onSubmit={submitCreate}>
              <div className={styles.createField}>
                <label className={styles.createLabel} htmlFor="groups-create-name">
                  Group name
                </label>
                <input
                  id="groups-create-name"
                  className={styles.createInput}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={200}
                  placeholder="e.g. Friday movie crew"
                  autoComplete="off"
                  disabled={createBusy}
                />
              </div>
              <div className={styles.createField}>
                <label className={styles.createLabel} htmlFor="groups-create-desc">
                  Description
                </label>
                <textarea
                  id="groups-create-desc"
                  className={styles.createTextarea}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="What’s this group for? (optional)"
                  disabled={createBusy}
                />
                <p className={styles.createHint}>Optional · shown on the group page · max 2000 characters</p>
              </div>
              <div className={styles.modalRow}>
                <button type="submit" className={styles.modalPrimary} disabled={createBusy}>
                  {createBusy ? "Creating…" : "Create group"}
                </button>
                <button type="button" className={styles.modalSecondary} onClick={closeCreateModal} disabled={createBusy}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
