import { useCallback, useEffect, useRef, useState } from "react";
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
  sendPasswordResetEmail,
} from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { addToast, setAuthLoadingMessage } from "../../app/uiSlice";
import { authRegister, fetchPresenceCount } from "../../lib/api";
import { setTheme, THEME_STORAGE_KEY } from "../../lib/theme";
import styles from "./AuthPage.module.scss";

const REMEMBER_EMAIL_KEY = "pulkiss-saved-email";

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

/** Heart in speech bubble + wordmark (login marketing). */
function AuthLoginMark({ compact = false }) {
  return (
    <div className={compact ? styles.markCompact : styles.mark}>
      <div className={styles.bubbleWrap} aria-hidden>
        <svg className={styles.bubbleSvg} viewBox="0 0 56 52" fill="none">
          <path
            className={styles.bubbleShape}
            d="M8 6h36c3.3 0 6 2.7 6 6v22c0 3.3-2.7 6-6 6H30l-10 8v-8H8c-3.3 0-6-2.7-6-6V12c0-3.3 2.7-6 6-6z"
          />
          <path
            className={styles.bubbleHeart}
            d="M28 32.2l-1.2-1.1C22.4 26.8 20 24.6 20 22c0-2.8 2.2-5 5-5 1.5 0 3 .7 3.8 1.8.9-1.1 2.3-1.8 3.8-1.8 2.8 0 5 2.2 5 5 0 2.6-2.4 4.8-6.8 9.1L28 32.2z"
          />
        </svg>
      </div>
      <span className={styles.markWord}>Pulkiss</span>
    </div>
  );
}

function IconMail() {
  return (
    <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinejoin="round" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg className={styles.eyeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg className={styles.eyeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** Users / presence icon for the hero online pill. */
function IconOnlinePill() {
  return (
    <svg className={styles.onlinePillSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className={styles.themeSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className={styles.themeSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function AuthPage() {
  const dispatch = useDispatch();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [online, setOnline] = useState(0);
  const [colorMode, setColorMode] = useState(() =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark"
  );

  const pendingGoogleCredRef = useRef(null);
  const [googleLinkEmail, setGoogleLinkEmail] = useState(null);
  const [googleLinkPassword, setGoogleLinkPassword] = useState("");
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchPresenceCount().then((n) => {
      if (typeof n === "number") setOnline(n);
    });
  }, []);

  const toggleColorMode = useCallback(() => {
    const next = colorMode === "dark" ? "light" : "dark";
    setColorMode(next);
    setTheme(next);
  }, [colorMode]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      if (e.newValue !== "light" && e.newValue !== "dark") return;
      setTheme(e.newValue);
      setColorMode(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persistRememberEmail = useCallback(() => {
    try {
      if (rememberMe && email.trim()) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [rememberMe, email]);

  const doEmailSignIn = async (e) => {
    e.preventDefault();
    const emailTrim = email.trim();
    persistRememberEmail();
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
      dispatch(addToast({ type: "warning", message: "Please agree to the Privacy Policy to create an account." }));
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

  const forgotPassword = async () => {
    const emailTrim = email.trim();
    if (!emailTrim) {
      dispatch(addToast({ type: "warning", message: "Enter your email above first." }));
      return;
    }
    dispatch(setAuthLoadingMessage("Sending reset link…"));
    const auth = getFirebaseAuth();
    try {
      await sendPasswordResetEmail(auth, emailTrim);
      dispatch(addToast({ type: "success", message: "Check your email for a password reset link." }));
    } catch (er) {
      dispatch(addToast({ type: "error", message: firebaseMessage(er) }));
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

  const onlineLabel = `${Math.max(0, online).toLocaleString()}+`;

  return (
    <div className={styles.page}>
      <div className={styles.mobileTop}>
        <AuthLoginMark compact />
        <button
          type="button"
          className={styles.themeBtn}
          onClick={toggleColorMode}
          aria-label={colorMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <div className={styles.split}>
        <aside className={styles.hero} aria-label="Pulkiss">
          <div className={styles.heroDecor} aria-hidden>
            <span className={styles.heroBubble} />
            <span className={styles.heroBubble} />
            <span className={styles.heroBubble} />
            <span className={styles.heroBubble} />
            <span className={styles.heroStar}>★</span>
            <span className={styles.heroStar}>✦</span>
          </div>
          <div className={styles.heroCenter}>
            <AuthLoginMark />
            <p className={styles.heroTagline}>Random video chat, groups, and shared experiences.</p>
            <div className={styles.heroDivider} role="presentation" />
            <p className={styles.heroMicro}>Meet · Connect · Enjoy</p>
          </div>
          <div className={styles.onlinePill}>
            <span className={styles.onlinePillIcon} aria-hidden>
              <IconOnlinePill />
            </span>
            <div className={styles.onlinePillCol}>
              <strong className={styles.onlinePillCount}>{onlineLabel}</strong>
              <span className={styles.onlinePillLabel}>People online now</span>
            </div>
          </div>
        </aside>

        <div className={styles.formSide}>
          <button
            type="button"
            className={styles.themeBtnDesktop}
            onClick={toggleColorMode}
            aria-label={colorMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

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
                Login
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
                Register
              </button>
            </div>

            {mode === "login" ? (
              <>
                <h1 className={styles.title}>Welcome Back</h1>
                <p className={styles.subtitle}>Sign in to continue to Pulkiss</p>
              </>
            ) : (
              <>
                <h1 className={styles.title}>Create your account</h1>
                <p className={styles.subtitle}>Sign up to join Pulkiss</p>
              </>
            )}

            {mode === "login" ? (
              <form onSubmit={doEmailSignIn} className={styles.form}>
                <label className={styles.label} htmlFor="auth-email">
                  Email address
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputAffix}>
                    <IconMail />
                  </span>
                  <input
                    id="auth-email"
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                  />
                </div>

                <label className={styles.label} htmlFor="auth-password">
                  Password
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputAffix}>
                    <IconLock />
                  </span>
                  <input
                    id="auth-password"
                    className={styles.input}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>

                <div className={styles.optionsRow}>
                  <label className={styles.remember}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <button type="button" className={styles.forgotBtn} onClick={() => void forgotPassword()}>
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className={styles.primary}>
                  Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={doRegister} className={styles.form}>
                <label className={styles.label} htmlFor="auth-name">
                  Full name
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputAffix}>
                    <IconUser />
                  </span>
                  <input
                    id="auth-name"
                    className={styles.input}
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    maxLength={128}
                    autoComplete="name"
                    placeholder="Jane Doe"
                  />
                </div>

                <label className={styles.label} htmlFor="auth-reg-email">
                  Email address
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputAffix}>
                    <IconMail />
                  </span>
                  <input
                    id="auth-reg-email"
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                  />
                </div>

                <label className={styles.label} htmlFor="auth-reg-password">
                  Password
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputAffix}>
                    <IconLock />
                  </span>
                  <input
                    id="auth-reg-password"
                    className={styles.input}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>

                <label className={styles.consent} htmlFor="auth-consent-privacy">
                  <input
                    id="auth-consent-privacy"
                    type="checkbox"
                    checked={agreedPrivacy}
                    onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <Link to="/privacy" className={styles.inlineLink}>
                      Privacy Policy
                    </Link>
                  </span>
                </label>

                <button type="submit" className={styles.primary}>
                  Create account
                </button>
              </form>
            )}

            <div className={styles.divider} role="presentation">
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>or continue with</span>
              <span className={styles.dividerLine} />
            </div>

            <button type="button" className={styles.google} onClick={() => void doGoogle()}>
              <GoogleMark />
              Continue with Google
            </button>

            <p className={styles.legal}>
              By continuing, you agree to our{" "}
              <Link to="/terms" className={styles.inlineLink}>
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className={styles.inlineLink}>
                Privacy Policy
              </Link>
              .
            </p>

            {googleLinkEmail ? (
              <form className={styles.linkForm} onSubmit={completeGoogleToPasswordLink}>
                <p className={styles.linkHelp}>
                  Account <strong>{googleLinkEmail}</strong> already uses email and password. Enter that password to link
                  Google.
                </p>
                <label className={styles.label} htmlFor="auth-link-password">
                  Password for existing account
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputAffix}>
                    <IconLock />
                  </span>
                  <input
                    id="auth-link-password"
                    className={styles.input}
                    type="password"
                    value={googleLinkPassword}
                    onChange={(e) => setGoogleLinkPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="current-password"
                    placeholder="Your account password"
                  />
                </div>
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
    </div>
  );
}
