import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { addToast } from "../../app/uiSlice";
import styles from "./ProfilePage.module.scss";

/** @param {unknown} er */
function firebaseCode(er) {
  return typeof er === "object" && er !== null && "code" in er ? String(er.code) : "";
}

/** @param {unknown} er */
function firebaseMessage(er) {
  return er instanceof Error ? er.message : "Something went wrong";
}

export function ProfilePage() {
  const dispatch = useDispatch();
  const { user: reduxUser } = useSelector((s) => s.auth);
  const auth = getFirebaseAuth();
  const cu = auth.currentUser;

  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setDisplayName(cu?.displayName ?? "");
  }, [cu?.uid, cu?.displayName]);

  const hasPasswordProvider = useMemo(
    () => !!cu?.providerData?.some((p) => p.providerId === EmailAuthProvider.PROVIDER_ID),
    [cu?.providerData]
  );

  const email = cu?.email ?? reduxUser?.email ?? "";

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

  if (!cu) {
    return (
      <div className={styles.wrap}>
        <h1>Profile</h1>
        <p className={styles.sub}>You need to be signed in to view this page.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h1>Profile</h1>
      <p className={styles.sub}>Update how you appear in the app and manage your password when you use email sign-in.</p>

      <section className={styles.card} aria-labelledby="profile-heading">
        <h2 id="profile-heading">Display name</h2>
        <p className={styles.meta}>
          Email: <strong>{email || "—"}</strong>
          <br />
          User ID: <strong>{cu.uid}</strong>
        </p>
        <form className={styles.form} onSubmit={(e) => void onSaveProfile(e)}>
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={128}
            autoComplete="name"
          />
          <div className={styles.row}>
            <button type="submit" className={styles.primary} disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="password-heading">
        <h2 id="password-heading">Password</h2>
        {hasPasswordProvider ? (
          <form className={styles.form} onSubmit={(e) => void onChangePassword(e)}>
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
            <div className={styles.row}>
              <button type="submit" className={styles.primary} disabled={savingPassword}>
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
    </div>
  );
}
