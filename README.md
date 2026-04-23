# Stranger match

A split-stack app: **1:1 random video chat with text**, **in-memory groups** with **chat and synchronized YouTube watch-together**, plus an **admin** area to manage Firebase users. **See [FEATURES.md](FEATURES.md)** for a full feature list.

- **Backend** ([`backend/`](backend/)) — Express + Socket.io, **Firebase Admin** to verify client ID tokens. **Groups, group chat, and the group YouTube player** live in **this server’s memory** (not a database; restart clears them, and a second Node process will not see the same data). The admin user list uses the Firebase **Auth** API.
- **Frontend** ([`frontend/`](frontend/)) — Vite, React, Redux Toolkit, SCSS, Firebase client (email/password + Google), Socket.io client.

The **backend** and **frontend** are separate npm projects: run `npm install` in each folder and use the scripts in `backend/package.json` and `frontend/package.json`.

## Prerequisites

- **Node 18+**
- A [Firebase](https://console.firebase.google.com) project with **Authentication** enabled (Email/Password and Google) and a **service account** (Project settings → Service accounts → **Generate new private key**) for the backend to verify tokens and call the **Auth** API. You do **not** need Cloud Firestore for this app.

## Firebase setup (short)

1. Firebase Console → **Authentication** → **Sign-in method**: enable **Email/Password** and **Google**.
2. **Project settings** → your **Web** app: copy the config into the frontend `VITE_*` environment variables (see [frontend/.env.example](frontend/.env.example)).
3. Add your domains to **Authorized domains** (localhost is included for local dev by default; add your production domain for deploy).
4. For the **backend**, set Firebase Admin credentials in **one** of these ways (see [backend/.env.example](backend/.env.example)):
   - **`FIREBASE_PROJECT_ID`**, **`FIREBASE_CLIENT_EMAIL`**, and **`FIREBASE_PRIVATE_KEY`** (use `\n` in the private key for newlines), or
   - **`FIREBASE_SERVICE_ACCOUNT_JSON`** = single-line JSON (same as the downloaded key file), or
   - **`GOOGLE_APPLICATION_CREDENTIALS`** = path to a key file (local only; do not commit the file).

## Environment

### Backend (development)

- Copy [backend/.env.example](backend/.env.example) to `backend/.env` **or** use the committed [backend/.env.development](backend/.env.development) as a base.
- If both `backend/.env.development` and `backend/.env` exist, **`.env` wins** for duplicate keys (so local secrets stay in `backend/.env`).
- **Production** (`NODE_ENV=production`): the server **does not** read a `.env` file. Set `PORT`, `CORS_ORIGIN`, `ADMIN_EMAIL`, and Firebase credentials in the process environment. See [backend/.env.production.example](backend/.env.production.example) for a checklist.
- `CORS_ORIGIN` must list your app origin in dev, e.g. `http://localhost:5173`, or the browser will block the API and Socket.io.

### Frontend (development and build)

- Copy [frontend/.env.example](frontend/.env.example) and set `VITE_*` in a **gitignored** file such as `frontend/.env` or `frontend/.env.development.local` (see [frontend/.env.example](frontend/.env.example) and comments in [frontend/.env.development](frontend/.env.development) / [frontend/.env.production](frontend/.env.production)).
- In **Vite dev**, you can leave `VITE_API_BASE` empty: the dev server **proxies** `/api` and `/socket.io` to the backend (default target `http://localhost:3000` unless you set `VITE_API_BASE` to change the proxy target).
- In **production**, if the static app and API are on the **same origin**, leave `VITE_API_BASE` empty; otherwise set it to your API base URL. Build-time `VITE_*` values are embedded in the client bundle.

### Admin email

The same person must be configured as the only admin in both:

- **Backend** — `ADMIN_EMAIL` (see [backend/.env.example](backend/.env.example)).
- **Frontend** (optional) — `VITE_ADMIN_EMAIL`; if omitted, the app falls back to a default in code. Only that user can use **`/admin`**.

**Admin API** (Bearer token + matching user email): `GET/PATCH/DELETE` under `/api/admin/users` (see [FEATURES.md](FEATURES.md) and [backend/routes/adminUsers.js](backend/routes/adminUsers.js)).

## Run locally (two terminals)

```bash
cd backend && npm install
cd ../frontend && npm install
```

```bash
# Terminal 1 — API + Socket.io
cd backend && npm run dev
```

```bash
# Terminal 2 — Vite
cd frontend && npm run dev
```

- **API + WebSocket** default: `http://localhost:3000` (override with `PORT` in dev env).
- **App** default: `http://localhost:5173`

### Production start (Node)

After `npm run build` in `frontend/`, serve `frontend/dist` with your static host, and run the API with the environment set (no `.env` file required on the server):

```bash
# From backend/ after npm install
NODE_ENV=production node server.js
# or, from backend/package.json
npm run start:prod
```

## Groups: HTTP and socket (short)

**Groups are in server RAM, not Firestore** — not duplicated across multiple Node processes.

Common **REST** uses (all authenticated unless noted):

- `POST /api/groups`, `GET /api/groups`, `GET /api/groups/:groupId`
- Join, accept, reject, remove, leave, messages, and **add YouTube URL to the group player queue**

The **synchronized YouTube** state is pushed over Socket.io; see [FEATURES.md](FEATURES.md) for behavior.

`GET /api/groups/:groupId` is sent with **`Cache-Control: no-store`** to reduce stale `player` data in the browser when used together with websockets.

## How auth works

1. The user signs in in the **browser** with Firebase (email, password, and/or Google).
2. The app sends the Firebase **ID token** in the Socket.io `auth` payload and as `Authorization: Bearer` on API calls.
3. The API uses `admin.auth().verifyIdToken` and does not store user passwords.

## Optional: ICE (WebRTC)

Set `ICE_SERVERS` (JSON array) in the **backend** environment for custom TURN/STUN. See [backend/.env.example](backend/.env.example). A default public STUN server may still be used by the client if the API is unavailable.

## License

MIT
