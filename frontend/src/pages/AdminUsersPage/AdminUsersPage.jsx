import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import {
  adminListUsers,
  adminSearchUsers,
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

/** @param {{ uid: string, email?: string | null, displayName?: string | null, presence?: { name?: string | null } }} u @param {string} qLower */
function userMatchesSearch(u, qLower) {
  const parts = [u.uid, u.email || "", u.displayName || "", u.presence?.name || ""].map((s) =>
    String(s).toLowerCase()
  );
  return parts.some((p) => p.includes(qLower));
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
  /** Which user row has the actions menu open (full admin only). */
  const [actionsMenuUid, setActionsMenuUid] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [apiSearchUsers, setApiSearchUsers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

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
    const trimmed = userSearch.trim();
    if (!trimmed) {
      setDebouncedSearch("");
      return undefined;
    }
    const t = window.setTimeout(() => {
      setDebouncedSearch(trimmed);
    }, 400);
    return () => window.clearTimeout(t);
  }, [userSearch]);

  const localSearchMatches = useMemo(() => {
    if (!debouncedSearch) {
      return null;
    }
    const qLower = debouncedSearch.toLowerCase();
    return users.filter((u) => userMatchesSearch(u, qLower));
  }, [users, debouncedSearch]);

  const displayedUsers = useMemo(() => {
    if (!debouncedSearch) {
      return users;
    }
    if (localSearchMatches && localSearchMatches.length > 0) {
      return localSearchMatches;
    }
    return apiSearchUsers;
  }, [users, debouncedSearch, localSearchMatches, apiSearchUsers]);

  useEffect(() => {
    if (!debouncedSearch) {
      setApiSearchUsers([]);
      setSearchLoading(false);
      setSearchError("");
      return undefined;
    }
    const qLower = debouncedSearch.toLowerCase();
    const local = users.filter((u) => userMatchesSearch(u, qLower));
    if (local.length > 0) {
      setApiSearchUsers([]);
      setSearchLoading(false);
      setSearchError("");
      return undefined;
    }
    let cancelled = false;
    setSearchLoading(true);
    setSearchError("");
    setApiSearchUsers([]);
    void adminSearchUsers(debouncedSearch)
      .then((res) => {
        if (!cancelled) {
          setApiSearchUsers(Array.isArray(res.users) ? res.users : []);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setApiSearchUsers([]);
          setSearchError(e.data?.error || e.message || "Search failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearchLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, users]);

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
      setCreateModalOpen(false);
      void load(undefined);
    } catch (err) {
      setError(err.data?.error || err.message || "Create user failed");
    } finally {
      setCreateBusy(false);
    }
  };

  const openEdit = (u) => {
    setActionsMenuUid(null);
    setCreateModalOpen(false);
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

  useEffect(() => {
    if (!actionsMenuUid) {
      return undefined;
    }
    const close = () => setActionsMenuUid(null);
    const onDocMouseDown = (e) => {
      const el = e.target;
      if (el instanceof Node && !document.querySelector(`[data-action-menu="${actionsMenuUid}"]`)?.contains(el)) {
        close();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [actionsMenuUid]);

  useEffect(() => {
    if (!createModalOpen) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === "Escape" && !createBusy) {
        setCreateModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createModalOpen, createBusy]);

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
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              setError("");
              setEditing(null);
              setCreateModalOpen(true);
            }}
          >
            Create user
          </button>
          <button type="button" className={styles.secondary} onClick={() => void onLogout()}>
            Log out
          </button>
        </div>
      </header>

      {error && <p className={styles.errorBanner}>{error}</p>}
      {createSuccess && <p className={styles.successBanner}>{createSuccess}</p>}

      <p className={styles.statsBar}>
        Active in this app right now: <strong>{stats.onlineInApp}</strong> (unique accounts with an open connection to
        this server)
      </p>

      <div className={styles.tableToolbar}>
        <label className={styles.searchLabel} htmlFor="admin-user-search">
          Search users
        </label>
        <div className={styles.searchRow}>
          <input
            id="admin-user-search"
            type="search"
            className={styles.searchInput}
            placeholder="Name, email, or UID…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {userSearch ? (
            <button type="button" className={styles.secondary} onClick={() => setUserSearch("")}>
              Clear
            </button>
          ) : null}
        </div>
        {debouncedSearch ? (
          <p className={styles.searchMeta} role="status">
            {searchLoading ? (
              "Searching…"
            ) : localSearchMatches && localSearchMatches.length > 0 ? (
              <>
                {localSearchMatches.length} match{localSearchMatches.length === 1 ? "" : "es"} in loaded pages
              </>
            ) : (
              <>
                {apiSearchUsers.length} result{apiSearchUsers.length === 1 ? "" : "s"} from server
                {apiSearchUsers.length === 0 && !searchError
                  ? " (try load more pages first, or use full email / UID)"
                  : null}
              </>
            )}
          </p>
        ) : null}
        {searchError ? <p className={styles.searchError}>{searchError}</p> : null}
      </div>

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
                <th className={styles.thActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptySearch}>
                    {debouncedSearch
                      ? searchLoading
                        ? "Searching…"
                        : "No users match this search."
                      : "No users in this list."}
                  </td>
                </tr>
              ) : (
                displayedUsers.map((u) => {
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
                      <div className={styles.actionMenuWrap} data-action-menu={u.uid}>
                        <button
                          type="button"
                          className={styles.actionMenuTrigger}
                          aria-expanded={actionsMenuUid === u.uid}
                          aria-haspopup="menu"
                          {...(actionsMenuUid === u.uid ? { "aria-controls": `user-actions-${u.uid}` } : {})}
                          id={`user-actions-btn-${u.uid}`}
                          onClick={() => setActionsMenuUid((open) => (open === u.uid ? null : u.uid))}
                        >
                          <span className={styles.srOnly}>User actions</span>
                          <svg className={styles.kebabIcon} viewBox="0 0 24 24" aria-hidden>
                            <circle cx="12" cy="5" r="2" fill="currentColor" />
                            <circle cx="12" cy="12" r="2" fill="currentColor" />
                            <circle cx="12" cy="19" r="2" fill="currentColor" />
                          </svg>
                        </button>
                        {actionsMenuUid === u.uid ? (
                          <ul
                            id={`user-actions-${u.uid}`}
                            className={styles.actionMenu}
                            role="menu"
                            aria-labelledby={`user-actions-btn-${u.uid}`}
                          >
                            <li role="none">
                              <button type="button" className={styles.actionMenuItem} role="menuitem" onClick={() => openEdit(u)}>
                                Edit…
                              </button>
                            </li>
                            <li role="none">
                              <button
                                type="button"
                                className={styles.actionMenuItem}
                                role="menuitem"
                                onClick={() => {
                                  setActionsMenuUid(null);
                                  void toggleDisabled(u);
                                }}
                              >
                                {u.disabled ? "Enable account" : "Disable account"}
                              </button>
                            </li>
                            <li role="none">
                              <button
                                type="button"
                                className={`${styles.actionMenuItem} ${styles.actionMenuItemDanger}`}
                                role="menuitem"
                                onClick={() => {
                                  setActionsMenuUid(null);
                                  void remove(u);
                                }}
                              >
                                Delete…
                              </button>
                            </li>
                          </ul>
                        ) : null}
                      </div>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                </tr>
                );
              })
              )}
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

      {createModalOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !createBusy) {
              setCreateModalOpen(false);
            }
          }}
        >
          <form
            className={`${styles.modal} ${styles.createModal}`}
            onSubmit={submitCreateUser}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-user-title">Create user</h2>
            <p className={styles.muted}>Assign role from the server allowlist (default: user, moderator).</p>
            <div className={styles.createForm}>
              <div className={styles.createGrid}>
                <div>
                  <label className={styles.fieldLabel} htmlFor="create-full-name">
                    Full name
                  </label>
                  <input
                    id="create-full-name"
                    className={styles.fieldInput}
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                    required
                    maxLength={128}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className={styles.fieldLabel} htmlFor="create-email">
                    Email
                  </label>
                  <input
                    id="create-email"
                    className={styles.fieldInput}
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className={styles.fieldLabel} htmlFor="create-password">
                    Temporary password
                  </label>
                  <input
                    id="create-password"
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
                  <label className={styles.fieldLabel} htmlFor="create-role">
                    Role
                  </label>
                  <select
                    id="create-role"
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
            </div>
            <div className={styles.row}>
              <button type="submit" className={styles.primary} disabled={createBusy}>
                {createBusy ? "Creating…" : "Create user"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={createBusy}
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
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
