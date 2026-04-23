/**
 * Client hint for who can open the admin UI. The API enforces the same allowlist (ADMIN_EMAIL on server).
 */
export function isAdminEmail(user) {
  if (!user?.email) {
    return false;
  }
  const admin = (import.meta.env.VITE_ADMIN_EMAIL || "ayub@gmail.com").toLowerCase();
  return user.email.toLowerCase() === admin;
}

/** Admin email or Firebase custom claim role moderator — can open user list & create users; only admin can edit/delete. */
export function canAccessUserManagement(user) {
  if (!user) {
    return false;
  }
  if (isAdminEmail(user)) {
    return true;
  }
  return user.role === "moderator";
}
