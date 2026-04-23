import express from "express";
import { createAuthUser, mintCustomTokenForUid } from "../lib/createAuthUser.js";

const router = express.Router();

const MAX_NAME = 128;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

function badRequest(res, msg) {
  return res.status(400).json({ error: msg });
}

/** Public self-signup: always role "user". Returns customToken so the client can sign in. */
router.post("/register", async (req, res) => {
  const emailRaw = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";

  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return badRequest(res, "Valid email is required");
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return badRequest(res, `Password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters`);
  }
  if (!fullName || fullName.length > MAX_NAME) {
    return badRequest(res, `Full name is required (max ${MAX_NAME} characters)`);
  }

  const role = "user";

  try {
    const created = await createAuthUser({ emailRaw, password, fullName, role });
    const customToken = await mintCustomTokenForUid(created.uid, role);

    return res.status(201).json({
      customToken,
      uid: created.uid,
      email: created.email,
      displayName: fullName,
      role,
    });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    if (code === "auth/email-already-exists") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    if (code === "auth/invalid-email") {
      return badRequest(res, "Invalid email");
    }
    if (code === "auth/weak-password") {
      return badRequest(res, "Password is too weak for Firebase");
    }
    console.error("auth/register", e);
    return res.status(500).json({ error: "Registration failed" });
  }
});

export default router;
