/**
 * Roles staff (admin email or moderator) may assign when creating a user.
 * Env STAFF_CREATE_USER_ROLES=comma,separated (default user,moderator).
 */
export function getStaffAssignableRoles() {
  const raw = process.env.STAFF_CREATE_USER_ROLES ?? "user,moderator";
  const roles = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return roles.length ? roles : ["user"];
}
