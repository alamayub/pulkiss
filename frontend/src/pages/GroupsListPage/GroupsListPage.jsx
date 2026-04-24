import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./GroupsListPage.module.scss";
import { groupsCreate, groupsList } from "../../lib/api";

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
      const r = await groupsCreate({ name, description: description || undefined });
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
      <div className={styles.hero}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Groups</h1>
            <p className={styles.subtitle}>
              Shared spaces for chat and watch-together. Join a group or start your own as admin.
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={openCreateModal}>
              <PlusIcon />
              Create group
            </button>
          </div>
        </header>
      </div>

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
                <div className={styles.itemBody}>
                  <span className={styles.name}>{g.name}</span>
                  <span className={styles.meta}>
                    {g.memberCount} members
                    {g.isMember ? " · You’re in this group" : ""}
                    {g.hasPendingRequest ? " · Join request pending" : ""}
                  </span>
                </div>
                <ChevronRight />
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
              You’ll be the admin: approve join requests, remove members, and control watch-together playback.
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
