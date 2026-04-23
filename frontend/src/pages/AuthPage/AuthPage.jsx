import { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithCustomToken,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { addToast, setAuthLoadingMessage } from "../../app/uiSlice";
import { authRegister } from "../../lib/api";
import styles from "./AuthPage.module.scss";

/** @param {unknown} er */
function firebaseCode(er) {
  return typeof er === "object" && er !== null && "code" in er ? String(er.code) : "";
}

/** @param {unknown} er */
function firebaseMessage(er) {
  return er instanceof Error ? er.message : "Something went wrong";
}

export function AuthPage() {
  const dispatch = useDispatch();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  /** Pending Google OAuth credential when Google sign-in hits an existing email/password account */
  const pendingGoogleCredRef = useRef(null);
  const [googleLinkEmail, setGoogleLinkEmail] = useState(null);
  const [googleLinkPassword, setGoogleLinkPassword] = useState("");

  const doEmailSignIn = async (e) => {
    e.preventDefault();
    const emailTrim = email.trim();
    dispatch(setAuthLoadingMessage("Signing in…"));
    const auth = getFirebaseAuth();
    try {
      await signInWithEmailAndPassword(auth, emailTrim, password);
    } catch (er) {
      const code = firebaseCode(er);
      if (code === "auth/popup-closed-by-user") {
        return;
      }
      let methods = [];
      try {
        methods = await fetchSignInMethodsForEmail(auth, emailTrim);
      } catch {
        methods = [];
      }
      try {
        const hasGoogle = methods.includes(GoogleAuthProvider.PROVIDER_ID);
        const hasPassword = methods.includes(EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD);
        if (hasGoogle && !hasPassword && password.length >= 8) {
          dispatch(
            addToast({
              type: "warning",
              message: "This email uses Google only. Sign in with Google once to attach this password.",
            })
          );
          dispatch(setAuthLoadingMessage("Opening Google…"));
          const p = new GoogleAuthProvider();
          p.setCustomParameters({ prompt: "select_account" });
          const { user } = await signInWithPopup(auth, p);
          const g = user.email?.toLowerCase();
          if (g !== emailTrim.toLowerCase()) {
            await signOut(auth);
            dispatch(
              addToast({
                type: "error",
                message: "Use the Google account that matches this email, then try again.",
              })
            );
            return;
          }
          const emailCred = EmailAuthProvider.credential(emailTrim, password);
          await linkWithCredential(user, emailCred);
          dispatch(addToast({ type: "success", message: "Password linked. You are signed in." }));
          return;
        }
        if (hasGoogle && hasPassword) {
          dispatch(
            addToast({
              type: "error",
              message: "Invalid email or password. You can also sign in with Google and accounts will stay linked.",
            })
          );
          return;
        }
      } catch (inner) {
        const ic = firebaseCode(inner);
        if (ic === "auth/popup-closed-by-user") {
          return;
        }
        dispatch(addToast({ type: "error", message: firebaseMessage(inner) }));
        return;
      }
      const hint =
        methods.length === 0 && (code === "auth/invalid-credential" || code === "auth/wrong-password")
          ? " If you use Google for this address, try Continue with Google."
          : "";
      dispatch(addToast({ type: "error", message: firebaseMessage(er) + hint }));
    } finally {
      dispatch(setAuthLoadingMessage(null));
    }
  };

  const cancelGoogleLinkForm = () => {
    pendingGoogleCredRef.current = null;
    setGoogleLinkEmail(null);
    setGoogleLinkPassword("");
  };

  const completeGoogleToPasswordLink = async (e) => {
    e.preventDefault();
    const cred = pendingGoogleCredRef.current;
    const em = googleLinkEmail;
    if (!cred || !em) return;
    if (googleLinkPassword.length < 8) {
      dispatch(addToast({ type: "warning", message: "Password must be at least 8 characters." }));
      return;
    }
    dispatch(setAuthLoadingMessage("Linking Google…"));
    const auth = getFirebaseAuth();
    try {
      const { user } = await signInWithEmailAndPassword(auth, em, googleLinkPassword);
      await linkWithCredential(user, cred);
      cancelGoogleLinkForm();
      dispatch(addToast({ type: "success", message: "Google linked to your account. You are signed in." }));
    } catch (er) {
      dispatch(addToast({ type: "error", message: firebaseMessage(er) }));
    } finally {
      dispatch(setAuthLoadingMessage(null));
    }
  };

  const doRegister = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      dispatch(
        addToast({
          type: "warning",
          message: "Use at least 8 characters for the password.",
        })
      );
      return;
    }
    if (!fullName.trim()) {
      dispatch(addToast({ type: "warning", message: "Enter your full name." }));
      return;
    }
    dispatch(setAuthLoadingMessage("Creating your account…"));
    const auth = getFirebaseAuth();
    try {
      const { customToken } = await authRegister({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });
      await signInWithCustomToken(auth, customToken);
      dispatch(addToast({ type: "success", message: "Account created. You are signed in." }));
    } catch (er) {
      const base = er instanceof Error ? er.message : "Registration failed";
      dispatch(addToast({ type: "error", message: base }));
    } finally {
      dispatch(setAuthLoadingMessage(null));
    }
  };

  const doGoogle = async () => {
    cancelGoogleLinkForm();
    dispatch(setAuthLoadingMessage("Signing in with Google…"));
    const auth = getFirebaseAuth();
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, p);
      dispatch(addToast({ type: "success", message: "Signed in with Google." }));
    } catch (er) {
      const code = firebaseCode(er);
      if (code === "auth/popup-closed-by-user") {
        return;
      }
      if (code === "auth/account-exists-with-different-credential") {
        const pending = GoogleAuthProvider.credentialFromError(er);
        const cd = typeof er === "object" && er !== null && "customData" in er ? er.customData : null;
        const em = cd && typeof cd === "object" && "email" in cd && typeof cd.email === "string" ? cd.email : undefined;
        if (pending && em) {
          pendingGoogleCredRef.current = pending;
          setGoogleLinkEmail(em);
          setGoogleLinkPassword("");
          dispatch(
            addToast({
              type: "warning",
              message: "This email already has a password. Enter it below to link Google sign-in.",
            })
          );
          return;
        }
      }
      dispatch(addToast({ type: "error", message: firebaseMessage(er) }));
    } finally {
      dispatch(setAuthLoadingMessage(null));
    }
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1>Stranger match</h1>
        <p className={styles.muted}>
          Log in with email or Google. If you already use one sign-in method for an email, the app can link the other
          after you confirm (same email). New accounts register with full name; new users get the default role{" "}
          <strong>user</strong>.
        </p>
      </header>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Email &amp; password</h2>
          <div className={styles.tabs} role="tablist" aria-label="Sign-in mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? styles.tabActive : styles.tab}
              onClick={() => setMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? styles.tabActive : styles.tab}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={doEmailSignIn} className={styles.form}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="current-password"
              />
              <div className={styles.row}>
                <button type="submit" className={styles.primary}>
                  Log in
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={doRegister} className={styles.form}>
              <label>Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={128}
                autoComplete="name"
                placeholder="Jane Doe"
              />
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <label>Password (8+ characters)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
              <div className={styles.row}>
                <button type="submit" className={styles.primary}>
                  Create account &amp; sign in
                </button>
              </div>
            </form>
          )}
        </section>

        <section className={styles.card}>
          <h2>Google</h2>
          <p className={styles.muted}>Use your Google account.</p>
          <button type="button" className={styles.google} onClick={() => void doGoogle()}>
            Continue with Google
          </button>
          {googleLinkEmail ? (
            <form className={styles.linkForm} onSubmit={completeGoogleToPasswordLink}>
              <p className={styles.linkHelp}>
                Account <strong>{googleLinkEmail}</strong> already uses email and password. Enter that password to
                attach Google.
              </p>
              <label>Password for existing account</label>
              <input
                type="password"
                value={googleLinkPassword}
                onChange={(e) => setGoogleLinkPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="current-password"
              />
              <div className={styles.row}>
                <button type="submit" className={styles.primary}>
                  Link Google &amp; sign in
                </button>
                <button type="button" className={styles.secondary} onClick={cancelGoogleLinkForm}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
