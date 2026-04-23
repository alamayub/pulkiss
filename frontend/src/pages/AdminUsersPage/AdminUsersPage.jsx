import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { adminListUsers, adminUpdateUser, adminDeleteUser } from "../../lib/api";
import styles from "./AdminUsersPage.module.scss";

function formatWhen(iso) {
  if (!iso) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

/**
 * @param {{ user: { uid: string, email?: string | null } }} props
 */
export function AdminUsersPage({ user }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ onlineInApp: 0 });
  const [nextToken, setNextToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    disabled: false,
  });

  const load = useCallback(
    async (pageToken) => {
      setError("");
      setLoading(true);
      try {
        const res = await adminListUsers(pageToken);
        setUsers((prev) => (pageToken ? [...prev, ...res.users] : res.users));
        setNextToken(res.nextPageToken || null);
        if (res.stats) {
          setStats({ onlineInApp: res.stats.onlineInApp ?? 0 });
        }
      } catch (e) {
        setError(e.data?.error || e.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load(undefined);
  }, [load]);

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      displayName: u.displayName || "",
      email: u.email || "",
      disabled: !!u.disabled,
    });
  };

  const closeEdit = () => {
    setEditing(null);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        displayName: form.displayName,
        email: form.email,
        disabled: form.disabled,
      };
      const res = await adminUpdateUser(editing.uid, body);
      setUsers((list) => list.map((x) => (x.uid === res.user.uid ? { ...x, ...res.user } : x)));
      closeEdit();
    } catch (err) {
      setError(err.data?.error || err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleDisabled = async (u) => {
    if (!window.confirm(`Set account ${u.disabled ? "enabled" : "disabled"} for ${u.email || u.uid}?`)) {
      return;
    }
    setError("");
    try {
      const res = await adminUpdateUser(u.uid, { disabled: !u.disabled });
      setUsers((list) => list.map((x) => (x.uid === res.user.uid ? { ...x, ...res.user } : x)));
    } catch (err) {
      setError(err.data?.error || err.message);
    }
  };

  const remove = async (u) => {
    if (u.uid === user?.uid) {
      window.alert("You cannot delete your own account from this screen.");
      return;
    }
    if (!window.confirm(`Permanently delete user ${u.email || u.uid}? This cannot be undone.`)) {
      return;
    }
    setError("");
    try {
      await adminDeleteUser(u.uid);
      setUsers((list) => list.filter((x) => x.uid !== u.uid));
    } catch (err) {
      setError(err.data?.error || err.message);
    }
  };

  const onLogout = async () => {
    const auth = getFirebaseAuth();
    await signOut(auth);
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.top}>
        <div>
          <h1>Firebase users</h1>
          <p className={styles.muted}>
            Admin: <strong>{user?.email}</strong> — only this account can use this page (enforced on the server).
          </p>
        </div>
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void load(undefined)}
            disabled={loading}
          >
            Refresh list
          </button>
          <Link to="/" className={styles.linkBtn}>
            Back to match
          </Link>
          <button type="button" className={styles.secondary} onClick={() => void onLogout()}>
            Log out
          </button>
        </div>
      </header>

      {error && <p className={styles.errorBanner}>{error}</p>}

      <p className={styles.statsBar}>
        Active in this app right now: <strong>{stats.onlineInApp}</strong> (unique accounts with an open connection to
        this server)
      </p>

      <div className={styles.tableWrap}>
        {loading && users.length === 0 ? (
          <p className={styles.muted}>Loading…</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email / UID</th>
                <th>Profile name</th>
                <th>Account</th>
                <th>App presence</th>
                <th>In-app name</th>
                <th>Last in app</th>
                <th>Firebase last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const p = u.presence || {};
                let lastInApp = "—";
                if (p.isOnline && p.sessionSince) {
                  lastInApp = `Since ${formatWhen(p.sessionSince)}`;
                } else if (p.lastOnlineAt) {
                  lastInApp = formatWhen(p.lastOnlineAt);
                } else if (p.hasConnectedToApp === false) {
                  lastInApp = "Never (this server)";
                }
                return (
                <tr key={u.uid} className={u.disabled ? styles.rowDisabled : undefined}>
                  <td>
                    <code className={styles.uid}>{u.uid.slice(0, 8)}…</code>
                    <br />
                    {u.email || "—"}
                  </td>
                  <td>{u.displayName || "—"}</td>
                  <td>{u.disabled ? "Disabled" : "Active"}</td>
                  <td>
                    {p.isOnline ? (
                      <span className={styles.badgeOn}>Online</span>
                    ) : (
                      <span className={styles.badgeOff}>Offline</span>
                    )}
                  </td>
                  <td title="Name from ID token on last connect">{p.name || "—"}</td>
                  <td className={styles.nowrap}>{lastInApp}</td>
                  <td>{u.lastSignInTime || "—"}</td>
                  <td className={styles.actions}>
                    <button type="button" className={styles.small} onClick={() => openEdit(u)}>
                      Edit
                    </button>
                    <button type="button" className={styles.small} onClick={() => void toggleDisabled(u)}>
                      {u.disabled ? "Enable" : "Disable"}
                    </button>
                    <button type="button" className={`${styles.small} ${styles.danger}`} onClick={() => void remove(u)}>
                      Delete
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {nextToken && (
        <button
          type="button"
          className={styles.primary}
          disabled={loading}
          onClick={() => void load(nextToken)}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}

      {editing && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal>
          <form className={styles.modal} onSubmit={saveEdit}>
            <h2>Edit user</h2>
            <p className={styles.muted}>UID: {editing.uid}</p>
            <label>Display name</label>
            <input
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={form.disabled}
                onChange={(e) => setForm((f) => ({ ...f, disabled: e.target.checked }))}
              />
              Account disabled
            </label>
            <div className={styles.row}>
              <button type="submit" className={styles.primary} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className={styles.secondary} onClick={closeEdit} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
