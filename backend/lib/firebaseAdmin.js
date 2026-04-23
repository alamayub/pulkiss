import admin from "firebase-admin";

let initialized = false;

/**
 * Private key in .env often has literal \n; Firebase needs real newlines.
 * @param {string | undefined} key
 * @returns {string | undefined}
 */
function normalizePrivateKey(key) {
  if (key == null || key === "") {
    return undefined;
  }
  return key.replace(/\\n/g, "\n");
}

/**
 * @returns {{ projectId: string, privateKey: string, clientEmail: string } | null} null if none of the vars are set
 */
function getServiceAccountFromSplitEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const n = [projectId, clientEmail, privateKey].filter(Boolean).length;
  if (n === 0) {
    return null;
  }
  if (n < 3) {
    throw new Error(
      "Set all three: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (or use FIREBASE_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS)"
    );
  }
  return {
    projectId,
    privateKey,
    clientEmail,
  };
}

function getAdmin() {
  if (initialized) {
    return admin;
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(json),
    });
  } else {
    const split = getServiceAccountFromSplitEnv();
    if (split) {
      admin.initializeApp({
        credential: admin.credential.cert(split),
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
    } else {
      throw new Error(
        "Set FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS to a service account file path"
      );
    }
  }
  initialized = true;
  return admin;
}

/**
 * @param {string} idToken
 * @returns {Promise<import("firebase-admin").auth.DecodedIdToken>}
 */
async function verifyIdToken(idToken) {
  const a = getAdmin();
  return a.auth().verifyIdToken(idToken);
}

export { getAdmin, verifyIdToken };
