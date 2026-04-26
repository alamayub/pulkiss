import { useCallback, useEffect, useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { useSessionSocket } from "../../hooks/useSessionSocket";
import { canAccessUserManagement } from "../../lib/admin";
import { setTheme, THEME_STORAGE_KEY } from "../../lib/theme";
import { setOnlineCount } from "../../app/roomSlice";
import { fetchPresenceCount } from "../../lib/api";
import { BrandMark } from "../BrandMark/BrandMark";
import styles from "./AppShell.module.scss";

const SIDEBAR_BREAKPOINT = "(min-width: 901px)";

/** Guest routes where legal copy scrolls with the page (no viewport-locked footer). */
const GUEST_LEGAL_DOC_PATHS = new Set(["/about", "/privacy", "/terms"]);

function navClass({ isActive }) {
  return isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem;
}

function bottomNavClass({ isActive }) {
  return isActive ? `${styles.bottomNavItem} ${styles.bottomNavItemActive}` : styles.bottomNavItem;
}

function SunIcon() {
  return (
    <svg className={styles.themeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className={styles.themeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MenuIcon({ open }) {
  if (open) {
    return (
      <svg className={styles.menuIcon} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={styles.menuIcon} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5z" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
    </svg>
  );
}

function IconLogOut() {
  return (
    <svg
      className={styles.rootNavSignOutIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

/**
 * Logged-in: fixed glass sidebar + main column. Guests: compact top bar.
 */
export function AppShell() {
  const dispatch = useDispatch();
  const { user, ready } = useSelector((s) => s.auth);
  const online = useSelector((s) => s.room.onlineCount);
  const location = useLocation();
  const { socket } = useSessionSocket(user?.uid ?? null);
  const [navOpen, setNavOpen] = useState(false);
  const [colorMode, setColorMode] = useState(() =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark"
  );

  const closeNav = useCallback(() => setNavOpen(false), []);

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

  useEffect(() => {
    closeNav();
  }, [location.pathname, closeNav]);

  useEffect(() => {
    const mq = window.matchMedia(SIDEBAR_BREAKPOINT);
    const onChange = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    if (!navOpen) {
      document.body.style.overflow = "";
      return undefined;
    }
    const mq = window.matchMedia("(max-width: 900px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  useEffect(() => {
    void fetchPresenceCount().then((c) => dispatch(setOnlineCount(c)));
  }, [dispatch]);

  useEffect(() => {
    if (!socket) return undefined;
    const onCount = (n) => {
      if (typeof n === "number") dispatch(setOnlineCount(n));
    };
    const onConnect = () => {
      void fetchPresenceCount().then((c) => dispatch(setOnlineCount(c)));
    };
    socket.on("connect", onConnect);
    socket.on("presence:count", onCount);
    return () => {
      socket.off("connect", onConnect);
      socket.off("presence:count", onCount);
    };
  }, [socket, dispatch]);

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

  const authed = !!(ready && user);
  /** Login/register (and auth bootstrap on `/`) fill the viewport — no guest chrome. */
  const authFullBleed = !user && location.pathname === "/";
  const guestLegalDoc = !authed && GUEST_LEGAL_DOC_PATHS.has(location.pathname);

  const sidebarNav = authed ? (
    <nav className={styles.sidebarNav} aria-label="Main" id="main-navigation">
      <NavLink to="/" className={navClass} onClick={closeNav} end>
        <IconHome />
        <span>Match</span>
      </NavLink>
      <NavLink to="/groups" className={navClass} onClick={closeNav}>
        <IconUsers />
        <span>Groups</span>
      </NavLink>
      <NavLink to="/profile" className={navClass} onClick={closeNav}>
        <IconUser />
        <span>Profile</span>
      </NavLink>
      {canAccessUserManagement(user) ? (
        <NavLink to="/admin" className={navClass} onClick={closeNav}>
          <IconShield />
          <span>Admin</span>
        </NavLink>
      ) : null}
    </nav>
  ) : null;

  const shellClass = [
    styles.shell,
    authed ? styles.shellAuthed : "",
    !authFullBleed && !guestLegalDoc ? styles.shellRootChrome : "",
    guestLegalDoc ? styles.shellGuestLegalDoc : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      {authed ? (
        <>
          {navOpen && (
            <button
              type="button"
              className={styles.scrim}
              aria-label="Close menu"
              onClick={closeNav}
            />
          )}
          <aside className={`${styles.sidebar} ${navOpen ? styles.sidebarOpen : ""}`}>
            <div className={styles.sidebarHead}>
              <Link to="/" className={styles.sidebarBrand} onClick={closeNav}>
                <BrandMark size="md" />
              </Link>
            </div>
            {sidebarNav}
            <div className={styles.sidebarOnline} title="Users currently connected to this app">
              <span className={styles.onlineDot} aria-hidden />
              <span className={styles.onlineLabel}>Online</span>
              <strong className={styles.onlineVal}>{online}</strong>
            </div>
            <div className={styles.sidebarBottom}>
              <div className={styles.sidebarLegal}>
                <Link to="/about" onClick={closeNav}>
                  About
                </Link>
                <span className={styles.sidebarLegalSep} aria-hidden>
                  ·
                </span>
                <Link to="/terms" onClick={closeNav}>
                  Terms
                </Link>
                <span className={styles.sidebarLegalSep} aria-hidden>
                  ·
                </span>
                <Link to="/privacy" onClick={closeNav}>
                  Privacy
                </Link>
                <p className={styles.sidebarLegalCopy}>© {new Date().getFullYear()} pulkiss</p>
              </div>
              <div className={styles.sidebarFoot}>
                <button
                  type="button"
                  className={styles.themeRow}
                  onClick={toggleColorMode}
                  aria-label={colorMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                >
                  {colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
                  <span>{colorMode === "dark" ? "Light mode" : "Dark mode"}</span>
                </button>
                <button type="button" className={styles.signOutRow} onClick={() => void onSignOut()}>
                  Sign out
                </button>
              </div>
            </div>
          </aside>
          <div className={styles.mainColumn}>
            <header className={styles.rootNavbar} role="banner">
              <div className={styles.rootNavbarInner}>
                <div className={styles.rootNavbarLeft}>
                  <button
                    type="button"
                    className={`${styles.sidebarMenuBtn} ${styles.rootNavMenuBtn}`}
                    onClick={() => setNavOpen((o) => !o)}
                    aria-expanded={navOpen}
                    aria-controls="main-navigation"
                    aria-label={navOpen ? "Close menu" : "Open menu"}
                  >
                    <MenuIcon open={navOpen} />
                  </button>
                  <Link to="/" className={styles.rootNavbarBrand} onClick={closeNav}>
                    <BrandMark size="sm" />
                  </Link>
                </div>
                <div className={styles.rootNavbarCenter}>
                  <div className={styles.rootNavbarCenterDesktop} aria-hidden />
                </div>
                <div className={styles.rootNavbarTrail}>
                  <div className={styles.rootNavbarOnline} title="Users currently connected to this app">
                    <span className={styles.onlineDot} aria-hidden />
                    <span className={styles.rootNavbarOnlineVal}>{online}</span>
                    <span className={styles.rootNavbarOnlineLabel}>online</span>
                  </div>
                  <button
                    type="button"
                    className={styles.rootNavSignOutBtn}
                    onClick={() => void onSignOut()}
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <IconLogOut />
                    <span className={styles.rootNavSignOutLabel}>Sign out</span>
                  </button>
                </div>
              </div>
            </header>
            <main className={styles.main}>
              <Outlet />
            </main>
            <nav className={styles.bottomNav} aria-label="Primary">
              <NavLink to="/" className={bottomNavClass} onClick={closeNav} end>
                <IconHome />
                <span className={styles.bottomNavLabel}>Home</span>
              </NavLink>
              <NavLink to="/groups" className={bottomNavClass} onClick={closeNav}>
                <IconUsers />
                <span className={styles.bottomNavLabel}>Groups</span>
              </NavLink>
              {canAccessUserManagement(user) ? (
                <NavLink to="/admin" className={bottomNavClass} onClick={closeNav}>
                  <IconShield />
                  <span className={styles.bottomNavLabelRow}>
                    <span className={styles.bottomNavLabel}>Users</span>
                    <span className={styles.bottomNavMiniBadge}>Admin</span>
                  </span>
                </NavLink>
              ) : null}
              <NavLink to="/profile" className={bottomNavClass} onClick={closeNav}>
                <IconUser />
                <span className={styles.bottomNavLabel}>Profile</span>
              </NavLink>
            </nav>
            <footer className={styles.footer}>
              <div className={styles.footerInner}>
                <div className={styles.footerLinks}>
                  <Link to="/about">About</Link>
                  <Link to="/terms">Terms of Use</Link>
                  <Link to="/privacy">Privacy Policy</Link>
                </div>
                <p className={styles.footerCopy}>© {new Date().getFullYear()} pulkiss</p>
              </div>
            </footer>
          </div>
        </>
      ) : authFullBleed ? (
        <main className={styles.mainAuthFullBleed}>
          <Outlet />
        </main>
      ) : (
        <>
          <header className={styles.rootNavbar} role="banner">
            <div className={styles.rootNavbarInner}>
              <Link to="/" className={styles.rootNavbarBrand}>
                <BrandMark size="sm" />
              </Link>
              <div className={styles.rootNavbarRight}>
                <nav className={styles.rootNavbarGuestNav} aria-label="Legal">
                  <Link to="/about">About</Link>
                  <Link to="/terms">Terms of Use</Link>
                  <Link to="/privacy">Privacy Policy</Link>
                </nav>
                <button
                  type="button"
                  className={styles.rootNavbarThemeBtn}
                  onClick={toggleColorMode}
                  aria-label={colorMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                >
                  {colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
                </button>
              </div>
            </div>
          </header>
          <main className={styles.main}>
            <Outlet />
          </main>
          <footer className={styles.footer}>
            <div className={styles.footerInner}>
              <div className={styles.footerLinks}>
                <Link to="/about">About</Link>
                <Link to="/terms">Terms of Use</Link>
                <Link to="/privacy">Privacy Policy</Link>
              </div>
              <p className={styles.footerTagline}>
                Pulkiss — random video match and groups. Video is peer-to-peer when your network allows; chat and presence
                go through the server you connect to.
              </p>
              <p className={styles.footerCopy}>
                © {new Date().getFullYear()} Pulkiss. React, Node, Firebase Auth, Socket.io.
                {!["/privacy", "/terms"].includes(location.pathname) ? (
                  <>
                    {" "}
                    See the <Link to="/terms">Terms of Use</Link> and <Link to="/privacy">Privacy Policy</Link> for this
                    app.
                  </>
                ) : null}
              </p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
