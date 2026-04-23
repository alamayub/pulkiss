import { getAdmin } from "./firebaseAdmin.js";

/**
 * @param {{ emailRaw: string, password: string, fullName: string, role: string }} p
 * @returns {Promise<{ uid: string, email: string | null | undefined, displayName: string, role: string }>}
 */
export async function createAuthUser({ emailRaw, password, fullName, role }) {
  const auth = getAdmin().auth();
  const email = emailRaw.trim().toLowerCase();
  const userRecord = await auth.createUser({
    email,
    password,
    displayName: fullName,
    emailVerified: false,
  });
  await auth.setCustomUserClaims(userRecord.uid, { role });
  return {
    uid: userRecord.uid,
    email: userRecord.email,
    displayName: fullName,
    role,
  };
}

/**
 * @param {string} uid
 * @param {string} role
 */
export async function mintCustomTokenForUid(uid, role) {
  return getAdmin().auth().createCustomToken(uid, { role });
}
