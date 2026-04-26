import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { groupsList } from "../../lib/api";
import { addToast } from "../../app/uiSlice";
import { getStoredTheme, setTheme } from "../../lib/theme";
import styles from "./ProfilePage.module.scss";

/** @param {unknown} er */
function firebaseCode(er) {
  return typeof er === "object" && er !== null && "code" in er ? String(er.code) : "";
}

/** @param {unknown} er */
function firebaseMessage(er) {
  return er instanceof Error ? er.message : "Something went wrong";
}

/** @param {string | undefined} name @param {string} uid */
function initials(name, uid) {
  const s = (name || "").trim();
  if (s.length >= 2) {
    return (s[0] + s[s.length - 1]).toUpperCase();
  }
  if (s.length === 1) {
    return s[0].toUpperCase();
  }
  return (uid || "?").slice(0, 2).toUpperCase();
}

/** @param {string | null | undefined} id */
function providerLabel(id) {
  if (id === "google.com") {
    return "Google";
  }
  if (id === EmailAuthProvider.PROVIDER_ID) {
    return "Email & password";
  }
  if (!id) {
    return "Unknown";
  }
  return id.replace(".com", "").replace(/_/g, " ");
}

function IconCalendar() {
  return (
    <svg className={styles.inlineIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg className={styles.camIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className={styles.statIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg className={styles.statIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className={styles.statIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg className={styles.chevronIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconAt() {
  return (
    <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function ProfilePage() {
  const dispatch = useDispatch();
  const { user: reduxUser } = useSelector((s) => s.auth);
  const auth = getFirebaseAuth();
  const cu = auth.currentUser;

  const [tab, setTab] = useState(/** @type {"about" | "security" | "preferences" | "linked"} */ ("about"));
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [groupCount, setGroupCount] = useState(0);
  const [colorMode, setColorMode] = useState(/** @type {"light" | "dark"} */ (getStoredTheme()));

  const photoInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const aboutAnchorRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    setDisplayName(cu?.displayName ?? "");
  }, [cu?.uid, cu?.displayName]);

  useEffect(() => {
    if (!cu?.uid) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await groupsList();
        const n = (r.groups || []).filter((g) => g.isMember).length;
        if (!cancelled) {
          setGroupCount(n);
        }
      } catch {
        if (!cancelled) {
          setGroupCount(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cu?.uid]);

  useEffect(() => {
    const sync = () => {
      const t = document.documentElement.getAttribute("data-theme");
      if (t === "light" || t === "dark") {
        setColorMode(t);
      }
    };
    sync();
    const onStorage = (e) => {
      if (e.key === "pulkiss-theme" && (e.newValue === "light" || e.newValue === "dark")) {
        setColorMode(e.newValue);
      }
    };
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("storage", onStorage);
    return () => {
      obs.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const hasPasswordProvider = useMemo(
    () => !!cu?.providerData?.some((p) => p.providerId === EmailAuthProvider.PROVIDER_ID),
    [cu?.providerData]
  );

  const email = cu?.email ?? reduxUser?.email ?? "";
  const photoURL = cu?.photoURL ?? reduxUser?.photoURL ?? null;
  const joinDate = useMemo(() => {
    const raw = cu?.metadata?.creationTime;
    if (!raw) {
      return "";
    }
    try {
      return new Date(raw).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }, [cu?.metadata?.creationTime]);

  const roleLabel = useMemo(() => {
    const r = reduxUser?.role;
    if (r === "admin") {
      return "Admin";
    }
    if (r === "moderator") {
      return "Moderator";
    }
    if (typeof r === "string" && r.length > 0) {
      return r.charAt(0).toUpperCase() + r.slice(1);
    }
    return "User";
  }, [reduxUser?.role]);

  const onSaveProfile = useCallback(
    async (e) => {
      e.preventDefault();
      if (!cu) {
        dispatch(addToast({ type: "error", message: "Not signed in." }));
        return;
      }
      const name = displayName.trim();
      if (!name) {
        dispatch(addToast({ type: "warning", message: "Enter a display name." }));
        return;
      }
      setSavingProfile(true);
      try {
        await updateProfile(cu, { displayName: name });
        dispatch(addToast({ type: "success", message: "Profile updated." }));
      } catch (er) {
        dispatch(addToast({ type: "error", message: firebaseMessage(er) }));
      } finally {
        setSavingProfile(false);
      }
    },
    [cu, displayName, dispatch]
  );

  const onPhotoChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !cu) {
        return;
      }
      if (!file.type.startsWith("image/")) {
        dispatch(addToast({ type: "warning", message: "Choose an image file." }));
        return;
      }
      if (file.size > 1.5 * 1024 * 1024) {
        dispatch(addToast({ type: "warning", message: "Image must be under 1.5 MB." }));
        return;
      }
      setUploadingPhoto(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== "string") {
          setUploadingPhoto(false);
          return;
        }
        try {
          await updateProfile(cu, { photoURL: dataUrl });
          dispatch(addToast({ type: "success", message: "Profile photo updated." }));
        } catch (er) {
          dispatch(
            addToast({
              type: "error",
              message:
                firebaseCode(er) === "auth/invalid-photo-url"
                  ? "That image could not be used. Try a smaller JPG or PNG."
                  : firebaseMessage(er),
            })
          );
        } finally {
          setUploadingPhoto(false);
        }
      };
      reader.onerror = () => {
        setUploadingPhoto(false);
        dispatch(addToast({ type: "error", message: "Could not read the file." }));
      };
      reader.readAsDataURL(file);
    },
    [cu, dispatch]
  );

  const onChangePassword = useCallback(
    async (e) => {
      e.preventDefault();
      if (!cu) {
        dispatch(addToast({ type: "error", message: "Not signed in." }));
        return;
      }
      if (!email) {
        dispatch(addToast({ type: "error", message: "No email on this account; use Google account settings." }));
        return;
      }
      if (newPassword.length < 8) {
        dispatch(addToast({ type: "warning", message: "New password must be at least 8 characters." }));
        return;
      }
      if (newPassword !== confirmPassword) {
        dispatch(addToast({ type: "warning", message: "New password and confirmation do not match." }));
        return;
      }
      setSavingPassword(true);
      try {
        const cred = EmailAuthProvider.credential(email, currentPassword);
        await reauthenticateWithCredential(cu, cred);
        await updatePassword(cu, newPassword);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        dispatch(addToast({ type: "success", message: "Password updated." }));
      } catch (er) {
        const code = firebaseCode(er);
        if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
          dispatch(addToast({ type: "error", message: "Current password is incorrect." }));
        } else if (code === "auth/requires-recent-login") {
          dispatch(
            addToast({
              type: "warning",
              message: "For security, sign out and sign in again, then change your password.",
            })
          );
        } else {
          dispatch(addToast({ type: "error", message: firebaseMessage(er) }));
        }
      } finally {
        setSavingPassword(false);
      }
    },
    [cu, email, currentPassword, newPassword, confirmPassword, dispatch]
  );

  const toggleTheme = useCallback(() => {
    const next = colorMode === "dark" ? "light" : "dark";
    setColorMode(next);
    setTheme(next);
  }, [colorMode]);

  const scrollToAbout = useCallback(() => {
    setTab("about");
    window.requestAnimationFrame(() => {
      aboutAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  if (!cu) {
    return (
      <div className={styles.wrap}>
        <div className={styles.guestCard}>
          <h1 className={styles.guestTitle}>Profile</h1>
          <p className={styles.guestSub}>You need to be signed in to view this page.</p>
        </div>
      </div>
    );
  }

  const display = displayName.trim() || cu.displayName || "Member";
  const tabs = [
    { id: /** @type {const} */ ("about"), label: "About" },
    { id: /** @type {const} */ ("security"), label: "Security" },
    { id: /** @type {const} */ ("preferences"), label: "Preferences" },
    { id: /** @type {const} */ ("linked"), label: "Linked accounts" },
  ];

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.avatarWrap}>
            {photoURL ? <img src={photoURL} alt="" className={styles.avatarImg} /> : <span className={styles.avatarLetter}>{initials(display, cu.uid)}</span>}
            <input ref={photoInputRef} type="file" accept="image/*" className={styles.photoInput} onChange={(e) => void onPhotoChange(e)} aria-hidden tabIndex={-1} />
            <button
              type="button"
              className={styles.camBtn}
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              aria-label={uploadingPhoto ? "Uploading photo" : "Change profile photo"}
              title="Change photo"
            >
              <IconCamera />
            </button>
          </div>
          <div className={styles.heroText}>
            <div className={styles.heroNameRow}>
              <h1 className={styles.heroName}>{display}</h1>
              <button type="button" className={styles.editChip} onClick={scrollToAbout}>
                Edit
              </button>
            </div>
            <p className={styles.heroEmail}>{email || "No email on file"}</p>
            <div className={styles.heroMetaRow}>
              <span className={styles.roleBadge}>{roleLabel}</span>
              {joinDate ? (
                <span className={styles.joined}>
                  <IconCalendar />
                  Joined {joinDate}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.statBlock}>
            <IconUsers />
            <span className={styles.statValue}>{groupCount}</span>
            <span className={styles.statLabel}>Groups</span>
          </div>
          <div className={styles.statBlock}>
            <IconChat />
            <span className={styles.statValue}>—</span>
            <span className={styles.statLabel}>Messages</span>
          </div>
          <div className={styles.statBlock}>
            <IconClock />
            <span className={styles.statValue}>—</span>
            <span className={styles.statLabel}>Watch time</span>
          </div>
        </div>
      </section>

      <nav className={styles.tabs} role="tablist" aria-label="Profile sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={styles.tabPanels}>
        {tab === "about" && (
          <div className={styles.twoCol} ref={aboutAnchorRef} id="profile-about">
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>About you</h3>
              <form className={styles.fieldForm} onSubmit={(e) => void onSaveProfile(e)}>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldIconWrap}>
                    <IconUser />
                  </span>
                  <div className={styles.fieldBody}>
                    <label htmlFor="displayName">Display name</label>
                    <input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={128}
                      autoComplete="name"
                    />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldIconWrap}>
                    <IconMail />
                  </span>
                  <div className={styles.fieldBody}>
                    <span className={styles.fieldLabel}>Email</span>
                    <p className={styles.fieldReadonly}>{email || "—"}</p>
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldIconWrap}>
                    <IconAt />
                  </span>
                  <div className={styles.fieldBody}>
                    <span className={styles.fieldLabel}>Full name</span>
                    <p className={styles.fieldReadonly}>{displayName.trim() || cu.displayName || "—"}</p>
                    <span className={styles.fieldHint}>Shown as your display name across the app.</span>
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldIconWrap}>
                    <IconShield />
                  </span>
                  <div className={styles.fieldBody}>
                    <span className={styles.fieldLabel}>User ID</span>
                    <p className={styles.fieldReadonlyMono}>{cu.uid}</p>
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimary} disabled={savingProfile}>
                    {savingProfile ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Activity</h3>
              <ul className={styles.activityList}>
                <li>
                  <Link to="/groups" className={styles.activityRow}>
                    <span className={styles.activityIcon}>
                      <IconUsers />
                    </span>
                    <div className={styles.activityCopy}>
                      <span className={styles.activityTitle}>Groups joined</span>
                      <span className={styles.activityValue}>{groupCount}</span>
                    </div>
                    <IconChevron />
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className={styles.activityRow}
                    onClick={() => dispatch(addToast({ type: "info", message: "Message totals will appear here when available." }))}
                  >
                    <span className={styles.activityIcon}>
                      <IconChat />
                    </span>
                    <div className={styles.activityCopy}>
                      <span className={styles.activityTitle}>Messages sent</span>
                      <span className={styles.activityMuted}>Coming soon</span>
                    </div>
                    <IconChevron />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={styles.activityRow}
                    onClick={() => dispatch(addToast({ type: "info", message: "Watch time tracking is not enabled yet." }))}
                  >
                    <span className={styles.activityIcon}>
                      <IconClock />
                    </span>
                    <div className={styles.activityCopy}>
                      <span className={styles.activityTitle}>Group watch time</span>
                      <span className={styles.activityMuted}>Coming soon</span>
                    </div>
                    <IconChevron />
                  </button>
                </li>
              </ul>
            </section>
          </div>
        )}

        {tab === "security" && (
          <section className={styles.cardWide}>
            <h3 className={styles.cardTitle}>Security</h3>
            <p className={styles.cardLead}>Update your password when you use email sign-in.</p>
            {hasPasswordProvider ? (
              <form className={styles.stackForm} onSubmit={(e) => void onChangePassword(e)}>
                <label htmlFor="currentPassword">Current password</label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <label htmlFor="newPassword">New password (8+ characters)</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
                <label htmlFor="confirmPassword">Confirm new password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimary} disabled={savingPassword}>
                    {savingPassword ? "Updating…" : "Update password"}
                  </button>
                </div>
              </form>
            ) : (
              <p className={styles.note}>
                This account signs in with Google only (no password stored here). To change how you sign in, use your Google
                account security settings, or link email/password from the sign-in screen when prompted.
              </p>
            )}
          </section>
        )}

        {tab === "preferences" && (
          <section className={styles.cardWide}>
            <h3 className={styles.cardTitle}>Preferences</h3>
            <p className={styles.cardLead}>Theme applies across the whole app.</p>
            <div className={styles.prefRow}>
              <div>
                <span className={styles.prefLabel}>Appearance</span>
                <p className={styles.prefHint}>{colorMode === "dark" ? "Dark mode" : "Light mode"}</p>
              </div>
              <button type="button" className={styles.themeToggle} onClick={toggleTheme} aria-label={`Switch to ${colorMode === "dark" ? "light" : "dark"} theme`}>
                <span className={colorMode === "light" ? styles.themeKnobActive : styles.themeKnob}>☀</span>
                <span className={colorMode === "dark" ? styles.themeKnobActive : styles.themeKnob}>☾</span>
              </button>
            </div>
          </section>
        )}

        {tab === "linked" && (
          <section className={styles.cardWide}>
            <h3 className={styles.cardTitle}>Linked accounts</h3>
            <p className={styles.cardLead}>Sign-in methods on this Firebase project.</p>
            {(cu.providerData || []).length === 0 ? (
              <p className={styles.note}>No linked providers were returned for this session.</p>
            ) : (
              <ul className={styles.linkedList}>
                {(cu.providerData || []).map((p) => (
                  <li key={p.providerId} className={styles.linkedRow}>
                    <span className={styles.linkedName}>{providerLabel(p.providerId)}</span>
                    <span className={styles.linkedMeta}>{p.email || p.uid || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <footer className={styles.mobileLegalStrip} aria-label="Legal">
        <div className={styles.mobileLegalLinks}>
          <Link to="/about">About</Link>
          <span className={styles.mobileLegalSep} aria-hidden>
            ·
          </span>
          <Link to="/terms">Terms</Link>
          <span className={styles.mobileLegalSep} aria-hidden>
            ·
          </span>
          <Link to="/privacy">Privacy</Link>
        </div>
        <p className={styles.mobileLegalCopy}>© {new Date().getFullYear()} pulkiss</p>
      </footer>
    </div>
  );
}
