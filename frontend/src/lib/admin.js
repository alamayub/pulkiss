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
