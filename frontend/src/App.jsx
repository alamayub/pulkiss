import { useSelector } from "react-redux";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "./components/Toast/ToastContainer";
import { GlobalLoading } from "./components/GlobalLoading/GlobalLoading";
import { useSessionSocket } from "./hooks/useSessionSocket";
import { AuthPage } from "./pages/AuthPage/AuthPage";
import { RoomPage } from "./pages/RoomPage/RoomPage";
import { AdminUsersPage } from "./pages/AdminUsersPage/AdminUsersPage";
import { AdminAccessDenied } from "./pages/AdminAccessDenied/AdminAccessDenied";
import { GroupsListPage } from "./pages/GroupsListPage/GroupsListPage";
import { GroupNewPage } from "./pages/GroupNewPage/GroupNewPage";
import { GroupDetailPage } from "./pages/GroupDetailPage/GroupDetailPage";
import { canAccessUserManagement, isAdminEmail } from "./lib/admin";
import styles from "./App.module.scss";

/** Keeps one shared authenticated socket alive on routes that do not mount RoomPage / GroupDetailPage. */
function SessionSocketHolder({ uid }) {
  useSessionSocket(uid);
  return null;
}

export default function App() {
  const { user, ready } = useSelector((s) => s.auth);

  return (
    <>
      <GlobalLoading />
      <ToastContainer />
      {user?.uid ? <SessionSocketHolder uid={user.uid} /> : null}
      {!ready ? (
        <div className={styles.boot}>
          <p>Loading…</p>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={!user ? <AuthPage /> : <RoomPage user={user} />} />
          <Route
            path="/admin"
            element={
              !user ? (
                <Navigate to="/" replace />
              ) : canAccessUserManagement(user) ? (
                <AdminUsersPage user={user} isFullAdmin={isAdminEmail(user)} />
              ) : (
                <AdminAccessDenied />
              )
            }
          />
          <Route path="/groups" element={!user ? <Navigate to="/" replace /> : <GroupsListPage />} />
          <Route path="/groups/new" element={!user ? <Navigate to="/" replace /> : <GroupNewPage />} />
          <Route
            path="/groups/:groupId"
            element={!user ? <Navigate to="/" replace /> : <GroupDetailPage user={user} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  );
}
