import mongoose from 'mongoose';
import { ConversationType, DEFAULT_USER_SETTINGS, PresenceStatus } from '@vcs/shared';
import { env } from '../config/env.js';

const { Types } = mongoose;

/**
 * References come back either populated or as a bare ObjectId depending on the
 * query, so every read goes through these helpers rather than guessing.
 */
function isPopulated(value) {
  return !!value && typeof value === 'object' && !(value instanceof Types.ObjectId);
}

export function idOf(value) {
  if (!value) return '';
  if (value instanceof Types.ObjectId) return value.toString();
  return value._id ? value._id.toString() : String(value);
}

function iso(value) {
  return value ? new Date(value).toISOString() : undefined;
}

function unknownUser(id) {
  return { id, name: 'Unknown', email: '', presence: PresenceStatus.Offline };
}

export function toUserSummary(value) {
  if (!isPopulated(value)) return null;
  return {
    id: value._id.toString(),
    name: value.name,
    email: value.email,
    avatarUrl: value.avatarUrl,
    presence: value.presence ?? PresenceStatus.Offline,
  };
}

export function toUserDto(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    presence: user.presence,
    settings: { ...DEFAULT_USER_SETTINGS, ...(user.settings?.toObject?.() ?? user.settings ?? {}) },
    emailVerified: user.emailVerified,
    lastSeenAt: iso(user.lastSeenAt),
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}

export function toParticipantDto(participant) {
  const user = toUserSummary(participant.user);
  return {
    id: participant._id.toString(),
    user: user ?? undefined,
    guestName: participant.guestName,
    displayName: participant.displayName,
    role: participant.role,
    media: participant.media?.toObject?.() ?? participant.media,
    joinedAt: iso(participant.joinedAt),
    leftAt: iso(participant.leftAt),
    // Only meaningful while connected; it is the WebRTC signaling address.
    socketId: participant.isOnline ? participant.socketId : undefined,
    isOnline: participant.isOnline,
  };
}

/** Guests open this link; it carries the meeting id the Join screen pre-fills. */
export function buildJoinUrl(meetingId) {
  const base = env.APP_PUBLIC_URL.endsWith('/')
    ? env.APP_PUBLIC_URL.slice(0, -1)
    : env.APP_PUBLIC_URL;
  return `${base}/join/${meetingId}`;
}

export function toMeetingDto(meeting) {
  const participants = (meeting.participants ?? []).map(toParticipantDto);
  return {
    id: meeting._id.toString(),
    meetingId: meeting.meetingId,
    title: meeting.title,
    description: meeting.description,
    host: toUserSummary(meeting.host) ?? unknownUser(idOf(meeting.host)),
    status: meeting.status,
    hasPasscode: Boolean(meeting.passcodeHash),
    scheduledStart: new Date(meeting.scheduledStart).toISOString(),
    scheduledEnd: new Date(meeting.scheduledEnd).toISOString(),
    startedAt: iso(meeting.startedAt),
    endedAt: iso(meeting.endedAt),
    settings: meeting.settings?.toObject?.() ?? meeting.settings,
    recurrence: meeting.recurrence?.toObject?.() ?? meeting.recurrence,
    invitees: (meeting.invitees ?? []).map(toUserSummary).filter(Boolean),
    participants,
    participantCount: participants.filter((participant) => participant.isOnline).length,
    joinUrl: buildJoinUrl(meeting.meetingId),
    createdAt: new Date(meeting.createdAt).toISOString(),
    updatedAt: new Date(meeting.updatedAt).toISOString(),
  };
}

export function toContactDto(contact) {
  return {
    id: contact._id.toString(),
    user: toUserSummary(contact.contact) ?? unknownUser(idOf(contact.contact)),
    status: contact.status,
    favorite: contact.favorite,
    incoming: contact.incoming,
    createdAt: new Date(contact.createdAt).toISOString(),
  };
}

export function fileUrl(file) {
  return `/api/v1/files/${file._id.toString()}/download`;
}

export function toFileDto(file) {
  return {
    id: file._id.toString(),
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
    url: fileUrl(file),
    owner: toUserSummary(file.owner) ?? unknownUser(idOf(file.owner)),
    meetingId: file.meeting ? idOf(file.meeting) : undefined,
    conversationId: file.conversation ? idOf(file.conversation) : undefined,
    createdAt: new Date(file.createdAt).toISOString(),
    updatedAt: new Date(file.updatedAt).toISOString(),
  };
}

export function toMessageDto(message) {
  const attachments = (message.attachments ?? []).filter(isPopulated).map((file) => ({
    fileId: file._id.toString(),
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
    url: fileUrl(file),
  }));

  return {
    id: message._id.toString(),
    conversationId: idOf(message.conversation),
    sender: toUserSummary(message.sender),
    type: message.type,
    body: message.deletedAt ? '' : message.body,
    attachments,
    readBy: (message.readBy ?? []).map(idOf),
    editedAt: iso(message.editedAt),
    createdAt: new Date(message.createdAt).toISOString(),
  };
}

export function toConversationDto(conversation, viewerId, unreadCount = 0) {
  const participants = (conversation.participants ?? []).map(toUserSummary).filter(Boolean);
  const other = participants.find((participant) => participant.id !== viewerId);
  const isDirect = conversation.type === ConversationType.Direct;

  return {
    id: conversation._id.toString(),
    type: conversation.type,
    // A direct thread is titled after the other person, never "Direct message".
    title: isDirect ? (other?.name ?? 'Direct message') : (conversation.title ?? 'Conversation'),
    avatarUrl: isDirect ? other?.avatarUrl : conversation.avatarUrl,
    participants,
    meetingId: conversation.meeting ? idOf(conversation.meeting) : undefined,
    lastMessage: isPopulated(conversation.lastMessage)
      ? toMessageDto(conversation.lastMessage)
      : undefined,
    unreadCount,
    updatedAt: new Date(conversation.lastMessageAt ?? conversation.updatedAt).toISOString(),
  };
}

export function toAuditLogDto(log) {
  const actor = log.actor;
  return {
    id: log._id.toString(),
    actor: isPopulated(actor)
      ? { id: actor._id.toString(), name: actor.name, email: actor.email }
      : null,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    metadata: log.metadata,
    ip: log.ip,
    createdAt: new Date(log.createdAt).toISOString(),
  };
}
