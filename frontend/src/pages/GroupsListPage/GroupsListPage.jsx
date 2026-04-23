import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./GroupsListPage.module.scss";
import { groupsList } from "../../lib/api";

export function GroupsListPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1>Groups</h1>
        <div className={styles.actions}>
          <Link to="/" className={styles.linkBtn}>
            Stranger match
          </Link>
          <Link to="/groups/new" className={styles.primary}>
            Create group
          </Link>
        </div>
      </header>
      {err && <p className={styles.err}>{err}</p>}
      {loading && !groups.length ? (
        <p>Loading…</p>
      ) : (
        <ul className={styles.list}>
          {groups.map((g) => (
            <li key={g.id}>
              <Link to={`/groups/${g.id}`} className={styles.item}>
                <span className={styles.name}>{g.name}</span>
                <span className={styles.meta}>
                  {g.memberCount} members
                  {g.isMember && " · You are in this group"}
                  {g.hasPendingRequest && " · Request pending"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {groups.length === 0 && !loading && <p className={styles.muted}>No groups yet. Create one.</p>}
    </div>
  );
}
