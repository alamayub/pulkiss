import { useSelector } from "react-redux";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "./components/Toast/ToastContainer";
import { GlobalLoading } from "./components/GlobalLoading/GlobalLoading";
import { AppShell } from "./components/AppShell/AppShell";
import { AuthPage } from "./pages/AuthPage/AuthPage";
import { RoomPage } from "./pages/RoomPage/RoomPage";
import { AdminUsersPage } from "./pages/AdminUsersPage/AdminUsersPage";
import { AdminAccessDenied } from "./pages/AdminAccessDenied/AdminAccessDenied";
import { GroupsListPage } from "./pages/GroupsListPage/GroupsListPage";
import { GroupDetailPage } from "./pages/GroupDetailPage/GroupDetailPage";
import { AboutPage } from "./pages/AboutPage/AboutPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage/PrivacyPolicyPage";
import { TermsOfUsePage } from "./pages/TermsOfUsePage/TermsOfUsePage";
import { ProfilePage } from "./pages/ProfilePage/ProfilePage";
import { canAccessUserManagement, isAdminEmail } from "./lib/admin";
import styles from "./App.module.scss";

function AuthLoadingScreen() {
  return (
    <div className={styles.boot}>
      <p>Loading…</p>
    </div>
  );
}

export default function App() {
  const { user, ready } = useSelector((s) => s.auth);

  return (
    <>
      <GlobalLoading />
      <ToastContainer />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfUsePage />} />
          <Route path="/" element={!ready ? <AuthLoadingScreen /> : !user ? <AuthPage /> : <RoomPage user={user} />} />
          <Route
            path="/admin"
            element={
              !ready ? (
                <AuthLoadingScreen />
              ) : !user ? (
                <Navigate to="/" replace />
              ) : canAccessUserManagement(user) ? (
                <AdminUsersPage user={user} isFullAdmin={isAdminEmail(user)} />
              ) : (
                <AdminAccessDenied />
              )
            }
          />
          <Route
            path="/groups"
            element={!ready ? <AuthLoadingScreen /> : !user ? <Navigate to="/" replace /> : <GroupsListPage />}
          />
          <Route
            path="/groups/new"
            element={
              !ready ? (
                <AuthLoadingScreen />
              ) : !user ? (
                <Navigate to="/" replace />
              ) : (
                <Navigate to="/groups" replace state={{ openCreate: true }} />
              )
            }
          />
          <Route
            path="/groups/:groupId"
            element={
              !ready ? <AuthLoadingScreen /> : !user ? <Navigate to="/" replace /> : <GroupDetailPage user={user} />
            }
          />
          <Route
            path="/profile"
            element={!ready ? <AuthLoadingScreen /> : !user ? <Navigate to="/" replace /> : <ProfilePage />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
