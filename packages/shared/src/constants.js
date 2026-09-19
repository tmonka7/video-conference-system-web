/**
 * Enums and limits shared by the API, the web app and the admin panel.
 * Every value here is also what MongoDB stores, so changing one is a migration.
 */

export const UserRole = Object.freeze({
  User: 'user',
  Admin: 'admin',
  SuperAdmin: 'superadmin',
});

export const UserStatus = Object.freeze({
  Active: 'active',
  Suspended: 'suspended',
  Deleted: 'deleted',
});

/** Presence shown on the Contacts screen. */
export const PresenceStatus = Object.freeze({
  Online: 'online',
  Offline: 'offline',
  InMeeting: 'in_meeting',
  Away: 'away',
  DoNotDisturb: 'dnd',
});

export const MeetingStatus = Object.freeze({
  Scheduled: 'scheduled',
  Live: 'live',
  Ended: 'ended',
  Cancelled: 'cancelled',
});

export const MeetingRole = Object.freeze({
  Host: 'host',
  CoHost: 'cohost',
  Participant: 'participant',
});

/** "Default Meeting Layout" in Settings. */
export const MeetingLayout = Object.freeze({
  Gallery: 'gallery',
  Speaker: 'speaker',
  Sidebar: 'sidebar',
});

export const RecurrenceFrequency = Object.freeze({
  None: 'none',
  Daily: 'daily',
  Weekly: 'weekly',
  Monthly: 'monthly',
});

export const ContactStatus = Object.freeze({
  Pending: 'pending',
  Accepted: 'accepted',
  Blocked: 'blocked',
});

export const ConversationType = Object.freeze({
  Direct: 'direct',
  Group: 'group',
  Meeting: 'meeting',
});

export const MessageType = Object.freeze({
  Text: 'text',
  File: 'file',
  System: 'system',
});

/** Tabs on the Meetings screen. */
export const MeetingListFilter = Object.freeze({
  Upcoming: 'upcoming',
  Past: 'past',
  All: 'all',
});

export const ErrorCode = Object.freeze({
  BadRequest: 'BAD_REQUEST',
  ValidationFailed: 'VALIDATION_FAILED',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  TooManyRequests: 'TOO_MANY_REQUESTS',
  Internal: 'INTERNAL_ERROR',
  MeetingFull: 'MEETING_FULL',
  MeetingEnded: 'MEETING_ENDED',
  InvalidPasscode: 'INVALID_PASSCODE',
  WaitingRoom: 'WAITING_ROOM',
});

/** A mesh topology stops being comfortable past this many publishers. */
export const MESH_PARTICIPANT_LIMIT = 8;
export const MEETING_ID_LENGTH = 9;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const DEFAULT_USER_SETTINGS = Object.freeze({
  autoJoinAudio: true,
  autoJoinVideo: true,
  showMeetingNotifications: true,
  defaultMeetingLayout: MeetingLayout.Gallery,
  muteOnJoin: false,
  mirrorSelfView: true,
  theme: 'system',
  language: 'en',
  timezone: 'UTC',
});

export const DEFAULT_MEETING_SETTINGS = Object.freeze({
  waitingRoom: false,
  muteParticipantsOnEntry: false,
  allowParticipantScreenShare: true,
  allowChat: true,
  allowRecording: false,
  joinBeforeHost: true,
  maxParticipants: MESH_PARTICIPANT_LIMIT,
  defaultLayout: MeetingLayout.Gallery,
});

/** Turns a list of enum values into `[value, ...]` for a Mongoose `enum`. */
export const valuesOf = (enumObject) => Object.values(enumObject);
