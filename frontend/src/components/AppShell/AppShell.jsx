import { useCallback, useEffect, useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { useSessionSocket } from "../../hooks/useSessionSocket";
import { canAccessUserManagement } from "../../lib/admin";
import { setTheme, THEME_STORAGE_KEY } from "../../lib/theme";
import styles from "./AppShell.module.scss";

function navClass({ isActive }) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

function SunIcon() {
  return (
    <svg
      className={styles.themeIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className={styles.themeIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/**
 * Global chrome: sticky header with primary nav and a footer. Renders child routes via `<Outlet />`.
 */
export function AppShell() {
  const { user, ready } = useSelector((s) => s.auth);
  const location = useLocation();
  const { socket } = useSessionSocket(user?.uid ?? null);
  const [colorMode, setColorMode] = useState(() =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark"
  );

  const toggleColorMode = useCallback(() => {
    const next = colorMode === "dark" ? "light" : "dark";
    setColorMode(next);
    setTheme(next);
  }, [colorMode]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== THEME_STORAGE_KEY) {
        return;
      }
      if (e.newValue !== "light" && e.newValue !== "dark") {
        return;
      }
      setTheme(e.newValue);
      setColorMode(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const display =
    user?.displayName || user?.email || user?.phoneNumber || (user?.uid ? user.uid.slice(0, 8) : "");

  const onSignOut = async () => {
    try {
      if (socket?.connected) {
        socket.emit("queue:leave");
      }
    } catch {
      /* ignore */
    }
    const auth = getFirebaseAuth();
    await signOut(auth);
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          Pulkiss
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/" className={navClass} end>
            Home
          </NavLink>
          <NavLink to="/about" className={navClass}>
            About
          </NavLink>
          <NavLink to="/privacy" className={navClass}>
            Privacy
          </NavLink>
          {ready && user ? (
            <>
              <NavLink to="/groups" className={navClass}>
                Groups
              </NavLink>
              <NavLink to="/profile" className={navClass}>
                Profile
              </NavLink>
              {canAccessUserManagement(user) ? (
                <NavLink to="/admin" className={navClass}>
                  User admin
                </NavLink>
              ) : null}
            </>
          ) : null}
        </nav>
        <div className={styles.userRow}>
          {ready && user ? (
            <span className={styles.userMeta} title={display}>
              {display}
            </span>
          ) : ready ? (
            <span className={styles.userMeta}>Not signed in</span>
          ) : (
            <span className={styles.userMeta}>Loading…</span>
          )}
          <div className={styles.userActions}>
            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggleColorMode}
              aria-label={colorMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={colorMode === "dark" ? "Light theme" : "Dark theme"}
            >
              {colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            {ready && user ? (
              <button type="button" className={styles.signOut} onClick={() => void onSignOut()}>
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLinks}>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/privacy">Privacy policy</Link>
            {user ? <Link to="/groups">Groups</Link> : null}
            {user ? <Link to="/profile">Profile</Link> : null}
          </div>
          <p className={styles.footerTagline}>
            Pulkiss — random video match and groups. Video is peer-to-peer when your network allows; chat and presence go
            through the server you connect to.
          </p>
          <p className={styles.footerCopy}>
            © {new Date().getFullYear()} Pulkiss. Open-source stack: React, Node, Firebase Auth, Socket.io.
            {location.pathname !== "/privacy" ? (
              <>
                {" "}
                <Link to="/privacy">Privacy policy</Link> applies to this app.
              </>
            ) : null}
          </p>
        </div>
      </footer>
    </div>
  );
}
