import { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
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

function GoogleMark() {
  return (
    <svg className={styles.googleMark} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
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
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

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
    if (!agreedPrivacy) {
      dispatch(addToast({ type: "warning", message: "Please agree to the Privacy policy to create an account." }));
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
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1>Welcome</h1>
          <p className={styles.lead}>
            Sign in with email or continue with Google. New accounts need your full name; new users get the default role{" "}
            <strong>user</strong>.
          </p>
        </header>

        <div className={styles.card}>
          <div className={styles.tabs} role="tablist" aria-label="Sign-in mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? styles.tabActive : styles.tab}
              onClick={() => {
                setMode("login");
                setAgreedPrivacy(false);
              }}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? styles.tabActive : styles.tab}
              onClick={() => {
                setMode("register");
                setAgreedPrivacy(false);
              }}
            >
              Create account
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={doEmailSignIn} className={styles.form}>
              {/* <label htmlFor="auth-email">Email</label> */}
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              {/* <label htmlFor="auth-password">Password</label> */}
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="current-password"
                placeholder="Password (8+ characters)"
              />
              <button type="submit" className={styles.primary}>
                Log in
              </button>
            </form>
          ) : (
            <form onSubmit={doRegister} className={styles.form}>
              {/* <label htmlFor="auth-name">Full name</label> */}
              <input
                id="auth-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={128}
                autoComplete="name"
                placeholder="Jane Doe"
              />
              {/* <label htmlFor="auth-reg-email">Email</label> */}
              <input
                id="auth-reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              {/* <label htmlFor="auth-reg-password">Password</label> */}
              <input
                id="auth-reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                placeholder="Password (8+ characters)"
              />
              <label className={styles.consent} htmlFor="auth-consent-privacy">
                <input
                  id="auth-consent-privacy"
                  type="checkbox"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                />
                <span className={styles.consentText}>
                  I agree to the{" "}
                  <Link to="/privacy" className={styles.consentLink}>
                    Privacy policy
                  </Link>
                </span>
              </label>
              <button type="submit" className={styles.primary}>
                Create account &amp; sign in
              </button>
            </form>
          )}

          <div className={styles.divider} role="presentation">
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <span className={styles.dividerLine} />
          </div>

          <button type="button" className={styles.google} onClick={() => void doGoogle()}>
            <GoogleMark />
            Continue with Google
          </button>

          {googleLinkEmail ? (
            <form className={styles.linkForm} onSubmit={completeGoogleToPasswordLink}>
              <p className={styles.linkHelp}>
                Account <strong>{googleLinkEmail}</strong> already uses email and password. Enter that password to
                attach Google.
              </p>
              <label htmlFor="auth-link-password">Password for existing account</label>
              <input
                id="auth-link-password"
                type="password"
                value={googleLinkPassword}
                onChange={(e) => setGoogleLinkPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="current-password"
                placeholder="Your account password"
              />
              <div className={styles.linkRow}>
                <button type="submit" className={styles.primary}>
                  Link Google &amp; sign in
                </button>
                <button type="button" className={styles.secondary} onClick={cancelGoogleLinkForm}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
