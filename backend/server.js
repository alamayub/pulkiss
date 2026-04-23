import "dotenv/config";
import http from "node:http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { Server } from "socket.io";
import { getAdmin, verifyIdToken } from "./lib/firebaseAdmin.js";
import * as presence from "./lib/presence.js";
import { getIceServers } from "./lib/ice.js";
import { initSocket } from "./socket/index.js";
import { setGroupPlayerIo } from "./lib/groupPlayerBroadcast.js";
import { setGroupJoinNotifyIo } from "./lib/groupJoinNotify.js";
import adminUsersRoutes from "./routes/adminUsers.js";
import authRoutes from "./routes/auth.js";
import groupsRoutes from "./routes/groups.js";

getAdmin();

const app = express();
const port = process.env.PORT || 3000;

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : true;

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "128kb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/presence", (req, res) => {
  res.json({ count: presence.get() });
});

app.get("/api/ice", (req, res) => {
  res.json({ iceServers: getIceServers() });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminUsersRoutes);
app.use("/api/groups", groupsRoutes);

app.get("/api/me", async (req, res) => {
  const h = req.headers.authorization;
  const token = h && h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = await verifyIdToken(token);
    const role = typeof decoded.role === "string" ? decoded.role : null;
    return res.json({
      user: {
        uid: decoded.uid,
        email: decoded.email || null,
        phone: decoded.phone_number || null,
        name: decoded.name || null,
        picture: decoded.picture || null,
        role,
      },
    });
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: corsOrigins, credentials: true },
});

setGroupPlayerIo(io);
setGroupJoinNotifyIo(io);
initSocket(io);

httpServer
  .listen(port, () => {
    console.log(`API + Socket on http://localhost:${port}`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Stop the other process (e.g. \`lsof -i :${port}\` then kill that PID) or set PORT in .env.`
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });
