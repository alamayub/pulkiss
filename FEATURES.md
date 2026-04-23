# Features

This document lists what the app does today. For setup and run instructions, see [README.md](README.md).

## Authentication and shell

- **Firebase Authentication** in the browser: sign in with **email and password** (log in or **register** via `POST /api/auth/register`, which always assigns role **user** and returns a custom token) or **Google**. Optional **account linking** when the same email exists on another provider.
- **Protected routes**: the home “stranger” experience, **Groups**, and **User management** require a signed-in user; unauthenticated visitors see the auth screen.
- **Global UI**: loading state during auth bootstrap, **toast** notifications for errors and important events (including **info** toasts for group join activity).
- **API and Socket access**: the client sends a Firebase **ID token** on HTTP (`Authorization: Bearer …`) and on the Socket.io handshake. The backend verifies tokens with Firebase Admin and never stores passwords.

## Stranger match (home, `/`)

- **Random 1:1 matching**: join a **queue**; when two different users are waiting, the server pairs them and starts a **match** session.
- **WebRTC video and audio** between the two peers, using signaling over Socket.io (`rtc:offer`, `rtc:answer`, `rtc:ice`). ICE servers can be configured on the API (default includes a public STUN server).
- **In-match text chat** (per match, not persisted after the call ends; messages are relayed through the server).
- **End call / leave queue**; **“Next”** to skip the current stranger and return both parties to a state where they can search again.
- **Presence count**: number of **connected, authenticated** sockets (for this server process) shown on the room; updates live and via `GET /api/presence`.
- **Disconnect handling**: if a peer leaves or disconnects, the other user is notified and the match ends.

## Groups (in-memory)

Groups, membership, **group chat**, and the **group YouTube player** are stored in **this Node process’s RAM** only. They are **not** in Firestore. **Restarting the server clears group data**; scaling to multiple Node instances would require a shared store (not included).

### Membership and requests

- **Create a group** with a name and optional description; the creator is the **group admin**.
- **List** groups and open a **group detail** page: members, role (admin or member), leave.
- **Join request flow** (for non-members): request to join → **admin accepts or rejects** → on accept, the user becomes a member.
- **Real-time toasts (Socket.io)** for join activity when the user has an authenticated socket:
  - **Group admins** get an **info** toast when someone **requests** to join (with requester name and group name).
  - The **requesting user** gets a **success** toast if the request was **accepted**, or a **warning** toast if it was **rejected** (with group name).
  - When a member **leaves** (but the group still exists), **remaining members** get an **info** toast with who left and the group name.
- **Admins** can **remove** other members. **Any member** can **leave** the group.
- If the **last admin** leaves and others remain, a member is **promoted** to admin. If the **last** member **leaves**, the group is **deleted**.

### Group chat

- **Text chat** in the group with timestamps and author names, loaded in pages; messages are not durable across server restarts.
- Polling in the UI refreshes messages and membership periodically, in addition to your own send actions.

### Synchronized YouTube (group “watch together”)

- **Queue**: members (and admins) can **add YouTube links**; items are listed with who added them.
- **Admin controls** the shared player: **play**, **pause**, **stop**, **next** in queue, **play this** on a queue item, **remove** from queue, and **seek** to a time.
- **Non-admins** see the same video and state; the iframe is not clickable for them so the **admin** stays the single source of truth.
- **Real-time sync** over Socket.io (`group:player:subscribe` / `group:player:state` / `group:player:command`); all members in the group player room receive state updates.
- **UI**: embedded YouTube player, **queue** with “on air” indicator, **link to open on YouTube** for admins, **progress bar** with current and total time (YouTube-style bar for the admin, read-only for others) when a video is active.

## User management (`/admin`)

- **Full admin** (configured **admin email** on the backend, optionally `VITE_ADMIN_EMAIL` on the frontend) can **list** Firebase users, **edit** profile fields and disabled state, and **delete** users (not your own account from that screen).
- **Moderators** (Firebase custom claim `role: moderator`) can open the same area to **list** users and **create** new users with a password and an assignable **role** (see `STAFF_CREATE_USER_ROLES` on the server). Only the configured admin email may **edit**, **disable**, or **delete** accounts.
- **Paginated list** of Firebase Auth users: email, display name, phone, disabled state, sign-in metadata, and more (as returned by the admin API).
- **In-app “online” hints** in the list are tied to **this server’s** live socket registry, not to Firebase’s global online state.

## Public HTTP endpoints (unauthenticated or minimal)

- **`GET /api/health`** — health check.
- **`POST /api/auth/register`** — create email/password account with full name (role is always **user**); returns a **custom token** for immediate sign-in.
- **`GET /api/presence`** — current connected-socket count (for the running server).
- **`GET /api/ice`** — WebRTC ICE server list for the client (optional TURN from env).

## Authenticated group HTTP API (summary)

All group routes require `Authorization: Bearer <Firebase ID token>`. The following are the main operations (not every edge case is listed here):

- Create and list groups; get group **detail** (including **player** state and **queue** for members).
- Join request, accept, reject, remove member, leave.
- Group **messages** list and post.
- **Add to YouTube player queue** (`POST …/player/queue` with a `url`).

## Limitations and deployment notes

- **Single process**: matching, presence, group state, and group player state assume **one** API + Socket process unless you add external state.
- **Production backend** can run **without a `.env` file** on disk if `PORT`, `CORS_ORIGIN`, `ADMIN_EMAIL`, and Firebase service credentials are set in the **environment** (see [README.md](README.md)). The frontend’s `VITE_*` values are **baked in at build time** for a static build.

## License

MIT (see [README.md](README.md)).
