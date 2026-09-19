# Video Conferencing System

Three apps in one npm workspaces monorepo. **Plain JavaScript (ESM) throughout —
no TypeScript, no build step for the backend.**

| Workspace | Path | What it is | Port |
| --- | --- | --- | --- |
| `@vcs/shared` | `packages/shared` | Enums, socket event names and formatters used by all three | – |
| `@vcs/server` | `apps/server` | REST API, MongoDB persistence, WebRTC signaling gateway | 4000 |
| `@vcs/frontend` | `apps/frontend` | React web client — the 16 screens from the mockups | 5173 |
| `@vcs/admin` | `apps/admin` | React admin panel | 5174 |

Media travels **peer to peer** over a WebRTC mesh. The server never touches audio
or video: it carries the SDP offer/answer exchange and ICE candidates, and owns
the meeting state every client mirrors. That keeps the backend cheap and is
comfortable up to `MESH_PARTICIPANT_LIMIT` (8) publishers per room; beyond that
an SFU would be the next step.

## Requirements

- **Node.js 18.x** — `engines` enforces it
- **MongoDB 5.0** — a local install, or `npm run db:up` (Docker)

## Getting started

```bash
npm install

cp apps/server/.env.example apps/server/.env
# set the two JWT secrets:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

cp apps/frontend/.env.example apps/frontend/.env
cp apps/admin/.env.example apps/admin/.env

npm run db:up     # MongoDB 5.0 on :27017 (skip if you run your own)
npm run seed      # demo users, meetings and chats from the mockups
npm run dev       # API + web client + admin panel together
```

Then open **http://localhost:5173** (web) and **http://localhost:5174** (admin).

The seed creates one super admin (`admin@company.com`) and the seven people from
the designs (`alex@company.com`, `sarah@company.com`, …). **Every seeded account
uses the password `Password123`.** Sign in to the admin panel as
`admin@company.com`; the others are ordinary users and the panel will refuse
them.

### Two browsers, one meeting

A mesh call needs two peers. Sign in as Alex in one browser and open
http://localhost:5173/join in a second browser (or a private window), enter the
meeting ID, and join as a guest.

`getUserMedia` only runs in a secure context, so use `localhost` / `127.0.0.1`
rather than a LAN IP, or put the dev server behind HTTPS.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | All three apps at once |
| `npm run dev:server` / `dev:frontend` / `dev:admin` | One app on its own |
| `npm test` | Server test suite (in-memory MongoDB, no external services) |
| `npm run seed` | Resets the database to the demo data |
| `npm run build` | Production bundles for both React apps |
| `npm start` | Runs the API with `node` (no watcher) |
| `npm run db:up` / `db:down` | Starts/stops MongoDB (and mongo-express on :8081) |

## Layout

```
packages/shared/src
  constants.js     roles, statuses, layouts, limits, default settings
  socket.js        event names, room names, payload reference
  format.js        meeting ids, byte/time/date formatting, initials

apps/server/src
  index.js         bootstrap: mongo -> http -> socket.io -> listen
  app.js           express app (helmet, cors, json, rate limit, errors)
  routes.js        mounts every module under /api/v1
  config/          validated env + logger        db/       mongoose connection
  models/          User, Meeting, Contact, Conversation, Message, FileAsset,
                   RefreshToken, AuditLog
  mappers/         documents -> API shapes (the only place responses are built)
  middleware/      auth, validation, uploads, rate limits, error handling
  modules/         auth, users, meetings, contacts, chat, files, admin
                     <name>.schema.js      zod request schemas
                     <name>.service.js     business rules, no express here
                     <name>.controller.js  thin http layer
                     <name>.routes.js      router wiring
  realtime/        socket.io server, meeting + chat gateways, presence
  tests/           vitest + supertest + mongodb-memory-server

apps/frontend/src
  lib/api.js       fetch client: envelope unwrapping, token refresh, endpoints
  lib/socket.js    the one shared socket connection
  lib/webrtc.js    PeerMesh — one RTCPeerConnection per participant
  hooks/           useMeetingRoom — owns the call
  components/      ui kit, icons, app shell, meeting/ (tiles, stage, controls)
  pages/           the 16 screens

apps/admin/src
  lib/api.js       admin endpoints        context/  admin-only auth guard
  components/      ui kit, layout, TrendChart
  pages/           Login, Dashboard, Users, Meetings, AuditLogs
```

Business rules live in the services, so the socket gateway and the REST
controllers share one implementation rather than two that drift.

## The 16 screens

| # | Screen | Where |
| --- | --- | --- |
| 1 | Splash | `pages/Splash.jsx` |
| 2 | Sign in (+ sign up, forgot password) | `pages/SignIn.jsx` |
| 3 | Home | `pages/Home.jsx` |
| 4 | Meetings (Upcoming / Past / All) | `pages/Meetings.jsx` |
| 5 | Join, with self preview | `pages/Join.jsx` |
| 6 | In call — gallery + chat panel | `pages/MeetingRoom.jsx`, `meeting/Stage.jsx` |
| 7 | In call — speaker view | same, layout switch |
| 8 | In call — screen share | same, sharing takes the stage automatically |
| 9 | Contacts | `pages/Contacts.jsx` |
| 10 | Chat | `pages/Chat.jsx` |
| 11 | Schedule meeting | `components/ScheduleMeetingModal.jsx` |
| 12 | Settings | `pages/Settings.jsx` |
| 13 | Participants | `meeting/SidePanel.jsx` |
| 14 | Share files | `pages/Files.jsx` |
| 15 | About | `pages/About.jsx` |
| 16 | Sidebar / mobile drawer | `components/AppLayout.jsx` |

## How a call is set up

1. `POST /api/v1/meetings/join` with the nine-digit id (and passcode, if set).
   The server checks the passcode, reserves a participant slot, and returns the
   meeting, the participant, the ICE servers and a short-lived **join token**.
2. The client opens a socket and emits `meeting:join` with that token.
3. The server replies `meeting:joined` with the list of **peers already in the
   room**. The joiner creates an `RTCPeerConnection` per peer and sends an offer;
   existing peers answer. Everyone else gets `participant:joined`.
   Because only the joiner ever offers, there is no glare to resolve.
4. `rtc:offer`, `rtc:answer` and `rtc:candidate` are relayed to one addressed
   socket. The server stamps `fromSocketId` itself and refuses to relay across
   meetings, so a client cannot impersonate a peer or reach another room.
5. Muting flips `track.enabled`; screen sharing calls `replaceTrack` on the
   existing video sender. Neither adds or removes a sender, so nothing has to be
   renegotiated mid-call.
6. `media:update` records mute/camera/share/hand state and broadcasts
   `participant:updated`, so every tile stays in sync.
7. Leaving, disconnecting or `host:end` marks participants offline and tells the
   room.

See [docs/API.md](docs/API.md) for the endpoints and
[packages/shared/src/socket.js](packages/shared/src/socket.js) for the event
payloads.

## Security notes

- Passwords are bcrypt hashed and never selected by default.
- Access tokens are short lived; refresh tokens are stored hashed, rotated on
  every use, and presenting a stale one revokes that user's sessions.
- Changing a password, suspending or deleting an account drops every session.
- Login answers identically for a wrong password and an unknown account.
- Meeting passcodes are hashed; the public lookup endpoint never returns one.
- Uploads are size limited, executable extensions are rejected, and download
  paths are resolved against the upload directory to block traversal.
- The admin panel refuses non-admin accounts client-side **and** every
  `/admin/*` route re-checks the role server-side.

## What is not built yet

- Email delivery: `POST /auth/forgot-password` returns the reset token in the
  response outside production instead of sending mail.
- Recording, live transcription, and an SFU path for large meetings.
- The waiting room is stored and enforced on join, but has no host approval UI.
- TURN is configurable but no server is bundled; without one, peers behind
  symmetric NAT will fail to connect.
