# API reference

Base URL: `http://localhost:4000/api/v1`

Every response uses one envelope:

```jsonc
// success
{ "success": true, "data": { /* ... */ } }

// failure
{ "success": false, "error": { "code": "VALIDATION_FAILED", "message": "…", "details": { "password": ["…"] } } }
```

Lists are `{ "items": [...], "meta": { "page", "limit", "total", "totalPages", "hasNext" } }`
and accept `?page=&limit=&search=&sort=`.

Authentication is `Authorization: Bearer <accessToken>`. The refresh token is
returned in the body and also set as an httpOnly cookie scoped to `/api/v1/auth`.

## Auth — `/auth`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/register` | – | Create an account, returns a session |
| POST | `/login` | – | Sign in with email **or** phone (`identifier`) |
| POST | `/refresh` | – | Rotate the refresh token |
| POST | `/logout` | – | Revoke the presented refresh token |
| POST | `/forgot-password` | – | Always 200; returns the token outside production |
| POST | `/reset-password` | – | Consume a reset token |
| GET | `/me` | yes | Current user |
| POST | `/logout-all` | yes | Revoke every session |
| POST | `/change-password` | yes | Change password, drops all sessions |

## Users — `/users`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | Current user |
| PATCH | `/me` | Name, phone, avatar URL |
| PATCH | `/me/settings` | Settings screen toggles and default layout |
| POST | `/me/avatar` | `multipart/form-data`, field `avatar` |
| DELETE | `/me` | Soft-delete the account |
| GET | `/` | Search people (`?search=`) for invites and new chats |
| GET | `/:id` | Public summary of one user |

## Meetings — `/meetings`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/config/ice` | – | STUN/TURN configuration for the client |
| GET | `/lookup/:code` | – | Title, host and whether a passcode is needed |
| POST | `/join` | optional | Validate passcode, reserve a slot, mint a join token |
| POST | `/` | yes | Schedule a meeting |
| POST | `/instant` | yes | "Start Meeting" — live immediately |
| GET | `/` | yes | `?filter=upcoming\|past\|all` |
| GET | `/:id` | yes | One meeting (id or nine-digit code) |
| PATCH | `/:id` | host | Edit title, times, passcode, invitees, settings |
| DELETE | `/:id` | host | Delete (not while live) |
| POST | `/:id/start` | host | Mark live |
| POST | `/:id/end` | host/co-host | End and disconnect everyone |
| POST | `/:id/cancel` | host | Cancel a scheduled meeting |
| POST | `/:id/invite` | host/co-host | Add invitees |
| GET | `/:id/participants` | member | Participant list with media state |
| DELETE | `/:id/participants/:participantId` | host/co-host | Remove someone |
| PATCH | `/:id/participants/:participantId/role` | host | Promote to co-host |

`POST /join` returns `{ meeting, participant, joinToken, iceServers }`. The
`joinToken` expires in `JWT_JOIN_TTL` (default 10 minutes) and is what the socket
connection presents.

Join errors carry a specific code: `INVALID_PASSCODE`, `MEETING_FULL`,
`MEETING_ENDED`, `WAITING_ROOM`.

## Contacts — `/contacts`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | `?status=&favoritesOnly=&search=` |
| POST | `/` | Invite by `identifier` (email or phone) |
| POST | `/:id/accept` | Accept an incoming invitation (updates both sides) |
| POST | `/:id/block` | Block |
| PATCH | `/:id/favorite` | `{ "favorite": true }` |
| DELETE | `/:id` | Remove |

## Chat — `/chat`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/conversations` | Threads with unread counts, newest activity first |
| POST | `/conversations` | Direct (reuses the existing thread) or group |
| GET | `/conversations/:id` | One thread |
| GET | `/conversations/:id/messages` | Paged, oldest first, `?before=` |
| POST | `/conversations/:id/messages` | Send text and/or attachments |
| POST | `/conversations/:id/read` | Move the read cursor |

## Files — `/files`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/` | `multipart/form-data`, field `file`, optional `meetingId`/`conversationId` |
| GET | `/` | Own uploads, or a meeting's/conversation's files |
| GET | `/:id` | Metadata |
| GET | `/:id/download` | Download with the original filename |
| DELETE | `/:id` | Uploader only |

## Admin — `/admin` (admin or super admin)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/overview` | User/meeting/storage counters and a daily trend (`?days=`) |
| GET | `/users` | `?role=&status=&search=` |
| POST | `/users` | Create an account |
| PATCH | `/users/:id` | Rename, change role, suspend, verify |
| DELETE | `/users/:id` | Soft delete — **super admin only** |
| GET | `/meetings` | Every meeting |
| POST | `/meetings/:id/end` | Force end a live meeting |
| GET | `/audit-logs` | `?action=&actorId=` |

Only a super admin may change roles or edit another administrator.

## Socket.IO

Connect to the server origin with `auth: { token: accessToken }`. Guests connect
without a token and prove their access with the meeting join token.

**Client → server**

| Event | Payload |
| --- | --- |
| `meeting:join` | `{ joinToken, media? }` |
| `meeting:leave` | `{ meetingId }` |
| `rtc:offer` / `rtc:answer` | `{ targetSocketId, description }` |
| `rtc:candidate` | `{ targetSocketId, candidate }` |
| `media:update` | `{ media: { audioEnabled?, videoEnabled?, screenSharing?, handRaised? } }` |
| `chat:send` | `{ conversationId? , meetingId?, body, attachmentIds? }` |
| `chat:typing` / `chat:read` | `{ conversationId, … }` |
| `host:mute` / `host:remove` | `{ participantId }` |
| `host:promote` | `{ participantId, role }` |
| `host:end` | `{ meetingId }` |

**Server → client**

| Event | Payload |
| --- | --- |
| `connection:ready` | `{ socketId, userId }` |
| `meeting:joined` | `{ meeting, self, peers }` — send an offer to each peer |
| `participant:joined` / `participant:left` / `participant:updated` | `{ meetingId, participant }` |
| `rtc:offer` / `rtc:answer` / `rtc:candidate` | same payload plus `fromSocketId` |
| `screen:started` / `screen:stopped` | `{ meetingId, participant }` |
| `chat:message` | `{ message }` |
| `chat:typing:update` | `{ conversationId, typing, userId, name }` |
| `meeting:ended` | `{ meetingId, reason }` |
| `presence:update` | `{ userId, presence }` |
| `error:raised` | `{ code, message, event? }` |
