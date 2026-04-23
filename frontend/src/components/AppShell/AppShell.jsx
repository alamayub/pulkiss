import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { useSessionSocket } from "../../hooks/useSessionSocket";
import { canAccessUserManagement } from "../../lib/admin";
import styles from "./AppShell.module.scss";

function navClass({ isActive }) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

/**
 * Global chrome: sticky header with primary nav and a footer. Renders child routes via `<Outlet />`.
 */
export function AppShell() {
  const { user, ready } = useSelector((s) => s.auth);
  const location = useLocation();
  const { socket } = useSessionSocket(user?.uid ?? null);

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
            <>
              <span className={styles.userMeta} title={display}>
                {display}
              </span>
              <button type="button" className={styles.signOut} onClick={() => void onSignOut()}>
                Sign out
              </button>
            </>
          ) : ready ? (
            <span className={styles.userMeta}>Not signed in</span>
          ) : (
            <span className={styles.userMeta}>Loading…</span>
          )}
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
