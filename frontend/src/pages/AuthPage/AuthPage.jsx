import { useState } from "react";
import { useDispatch } from "react-redux";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { addToast, setAuthLoadingMessage } from "../../app/uiSlice";
import styles from "./AuthPage.module.scss";

export function AuthPage() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const doEmailSignIn = async (e) => {
    e.preventDefault();
    dispatch(setAuthLoadingMessage("Signing in…"));
    const auth = getFirebaseAuth();
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (er) {
      dispatch(
        addToast({
          type: "error",
          message: er instanceof Error ? er.message : "Sign in failed",
        })
      );
    } finally {
      dispatch(setAuthLoadingMessage(null));
    }
  };

  const doEmailSignUp = async (e) => {
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
    dispatch(setAuthLoadingMessage("Creating your account…"));
    const auth = getFirebaseAuth();
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      dispatch(addToast({ type: "success", message: "Account created. Welcome!" }));
    } catch (er) {
      dispatch(
        addToast({
          type: "error",
          message: er instanceof Error ? er.message : "Sign up failed",
        })
      );
    } finally {
      dispatch(setAuthLoadingMessage(null));
    }
  };

  const doGoogle = async () => {
    dispatch(setAuthLoadingMessage("Signing in with Google…"));
    const auth = getFirebaseAuth();
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, p);
      dispatch(addToast({ type: "success", message: "Signed in with Google." }));
    } catch (er) {
      if (typeof er === "object" && er !== null && "code" in er && er.code === "auth/popup-closed-by-user") {
        // no toast; user cancelled
      } else {
        dispatch(
          addToast({
            type: "error",
            message: er instanceof Error ? er.message : "Google sign-in failed",
          })
        );
      }
    } finally {
      dispatch(setAuthLoadingMessage(null));
    }
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1>Stranger match</h1>
        <p className={styles.muted}>
          Sign in with email or Google. This API does not store accounts — Firebase handles sign-in; the server only
          verifies ID tokens.
        </p>
      </header>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Email &amp; password</h2>
          <form onSubmit={doEmailSignIn} className={styles.form}>
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
              autoComplete="current-password"
            />
            <div className={styles.row}>
              <button type="submit" className={styles.primary}>
                Log in
              </button>
              <button type="button" className={styles.secondary} onClick={doEmailSignUp}>
                Sign up
              </button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h2>Google</h2>
          <p className={styles.muted}>Use your Google account.</p>
          <button type="button" className={styles.google} onClick={() => void doGoogle()}>
            Continue with Google
          </button>
        </section>
      </div>
    </div>
  );
}
