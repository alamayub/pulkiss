import { useCallback, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import {
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
  adminCreateUser,
  adminFetchCreateUserRoleOptions,
} from "../../lib/api";
import styles from "./AdminUsersPage.module.scss";

function roleLabel(role) {
  if (role === "moderator") return "Moderator";
  if (role === "user") return "User";
  return role;
}

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
 * @param {{ user: { uid: string, email?: string | null, role?: string | null }, isFullAdmin: boolean }} props
 */
export function AdminUsersPage({ user, isFullAdmin }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ onlineInApp: 0 });
  const [nextToken, setNextToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [createRoles, setCreateRoles] = useState(["user", "moderator"]);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "user",
  });
  const [createBusy, setCreateBusy] = useState(false);
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

  useEffect(() => {
    void adminFetchCreateUserRoleOptions()
      .then((roles) => {
        setCreateRoles(roles);
        setCreateForm((f) => ({ ...f, role: roles.includes(f.role) ? f.role : roles[0] || "user" }));
      })
      .catch(() => {});
  }, []);

  const submitCreateUser = async (e) => {
    e.preventDefault();
    setCreateBusy(true);
    setError("");
    setCreateSuccess("");
    try {
      await adminCreateUser({
        email: createForm.email.trim(),
        password: createForm.password,
        fullName: createForm.fullName.trim(),
        role: createForm.role,
      });
      setCreateForm((f) => ({
        fullName: "",
        email: "",
        password: "",
        role: createRoles.includes(f.role) ? f.role : createRoles[0] || "user",
      }));
      setCreateSuccess("User created. They can sign in with this email and password.");
      void load(undefined);
    } catch (err) {
      setError(err.data?.error || err.message || "Create user failed");
    } finally {
      setCreateBusy(false);
    }
  };

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
            Signed in as <strong>{user?.email}</strong>
            {isFullAdmin ? " (full admin)" : " (moderator)"}. Server rules: moderators can list and create users; only
            the configured admin email can edit, disable, or delete accounts.
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
          <button type="button" className={styles.secondary} onClick={() => void onLogout()}>
            Log out
          </button>
        </div>
      </header>

      {error && <p className={styles.errorBanner}>{error}</p>}
      {createSuccess && <p className={styles.successBanner}>{createSuccess}</p>}

      <section className={styles.createPanel}>
        <h2 className={styles.createTitle}>Create user</h2>
        <p className={styles.muted}>Assign role from the server allowlist (default: user, moderator).</p>
        <form className={styles.createForm} onSubmit={submitCreateUser}>
          <div className={styles.createGrid}>
            <div>
              <label className={styles.fieldLabel}>Full name</label>
              <input
                className={styles.fieldInput}
                value={createForm.fullName}
                onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                required
                maxLength={128}
                autoComplete="name"
              />
            </div>
            <div>
              <label className={styles.fieldLabel}>Email</label>
              <input
                className={styles.fieldInput}
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className={styles.fieldLabel}>Temporary password</label>
              <input
                className={styles.fieldInput}
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={styles.fieldLabel}>Role</label>
              <select
                className={styles.fieldInput}
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
              >
                {createRoles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className={styles.primary} disabled={createBusy}>
            {createBusy ? "Creating…" : "Create user"}
          </button>
        </form>
      </section>

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
                    {isFullAdmin ? (
                      <>
                        <button type="button" className={styles.small} onClick={() => openEdit(u)}>
                          Edit
                        </button>
                        <button type="button" className={styles.small} onClick={() => void toggleDisabled(u)}>
                          {u.disabled ? "Enable" : "Disable"}
                        </button>
                        <button type="button" className={`${styles.small} ${styles.danger}`} onClick={() => void remove(u)}>
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
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
