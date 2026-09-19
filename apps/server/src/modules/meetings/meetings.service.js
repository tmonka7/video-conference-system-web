import mongoose from 'mongoose';
import {
  DEFAULT_MEETING_SETTINGS,
  ErrorCode,
  MeetingListFilter,
  MeetingRole,
  MeetingStatus,
  UserStatus,
  normalizeMeetingId,
} from '@vcs/shared';
import { env } from '../../config/env.js';
import { idOf, toMeetingDto, toParticipantDto } from '../../mappers/index.js';
import { Meeting } from '../../models/Meeting.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateMeetingId, isValidMeetingId } from '../../utils/meetingId.js';
import { signJoinToken } from '../../utils/jwt.js';
import { escapeRegex, resolvePagination } from '../../utils/pagination.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { paginated } from '../../utils/response.js';
import { recordAudit } from '../admin/audit.service.js';

const { Types } = mongoose;
const POPULATE = ['host', 'invitees', 'participants.user'];

/** Mesh clients need somewhere to discover their public address. */
export function iceServers() {
  const servers = [{ urls: env.stunUrls }];
  if (env.TURN_URL) {
    servers.push({
      urls: env.TURN_URL,
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL,
    });
  }
  return servers;
}

/** Accepts either a Mongo id or the nine-digit meeting number. */
export async function findMeeting(idOrCode, options = {}) {
  let query = null;
  if (Types.ObjectId.isValid(idOrCode) && String(idOrCode).length === 24) {
    query = Meeting.findById(idOrCode);
  } else if (isValidMeetingId(idOrCode)) {
    query = Meeting.findOne({ meetingId: normalizeMeetingId(idOrCode) });
  }

  if (!query) throw ApiError.notFound('Meeting not found');
  if (options.withPasscode) query = query.select('+passcodeHash');

  const meeting = await query.populate(POPULATE);
  if (!meeting) throw ApiError.notFound('Meeting not found');
  return meeting;
}

/**
 * References may or may not be populated depending on the query, and guests
 * have no user id at all, so every comparison goes through this.
 */
function sameUser(reference, userId) {
  if (!userId || !reference) return false;
  return idOf(reference) === String(userId);
}

export function isHost(meeting, userId) {
  return sameUser(meeting.host, userId);
}

function hasAccess(meeting, userId) {
  if (isHost(meeting, userId)) return true;
  if (meeting.invitees.some((invitee) => sameUser(invitee, userId))) return true;
  return meeting.participants.some((participant) => sameUser(participant.user, userId));
}

export function assertHost(meeting, userId) {
  if (!isHost(meeting, userId)) throw ApiError.forbidden('Only the host can do that');
}

/** Host plus anyone the host promoted to co-host. */
export function assertHostOrCoHost(meeting, userId) {
  if (isHost(meeting, userId)) return;
  const participant = meeting.participants.find((p) => sameUser(p.user, userId));
  if (participant?.role !== MeetingRole.CoHost) {
    throw ApiError.forbidden('Only the host or a co-host can do that');
  }
}

async function uniqueMeetingId() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateMeetingId();
    if (!(await Meeting.exists({ meetingId: candidate }))) return candidate;
  }
  throw ApiError.internal('Could not allocate a meeting id, please try again');
}

async function validateInvitees(inviteeIds = []) {
  if (inviteeIds.length === 0) return [];

  const unique = [...new Set(inviteeIds)];
  const users = await User.find({ _id: { $in: unique }, status: UserStatus.Active }).select('_id');
  if (users.length !== unique.length) {
    throw ApiError.badRequest('One or more invited people could not be found');
  }
  return users.map((user) => user._id);
}

function mergeSettings(partial) {
  return { ...DEFAULT_MEETING_SETTINGS, ...(partial ?? {}) };
}

export async function createMeeting(hostId, input) {
  const meeting = await Meeting.create({
    meetingId: await uniqueMeetingId(),
    title: input.title,
    description: input.description,
    host: hostId,
    status: MeetingStatus.Scheduled,
    passcodeHash: input.passcode ? await hashPassword(input.passcode) : undefined,
    scheduledStart: new Date(input.scheduledStart),
    scheduledEnd: new Date(input.scheduledEnd),
    settings: mergeSettings(input.settings),
    recurrence: input.recurrence,
    invitees: await validateInvitees(input.inviteeIds),
  });

  await recordAudit({
    actor: hostId,
    action: 'meeting.created',
    targetType: 'Meeting',
    targetId: meeting._id.toString(),
  });

  return toMeetingDto(await meeting.populate(POPULATE));
}

/** "Start Meeting" on the Home screen: live immediately, one hour long. */
export async function startInstantMeeting(host, input) {
  const now = new Date();
  const meeting = await Meeting.create({
    meetingId: await uniqueMeetingId(),
    title: input.title ?? `${host.name.split(' ')[0]}'s meeting`,
    host: host._id,
    status: MeetingStatus.Live,
    startedAt: now,
    scheduledStart: now,
    scheduledEnd: new Date(now.getTime() + 60 * 60 * 1000),
    settings: mergeSettings(input.settings),
  });

  await recordAudit({
    actor: host._id,
    action: 'meeting.started_instant',
    targetType: 'Meeting',
    targetId: meeting._id.toString(),
  });

  return toMeetingDto(await meeting.populate(POPULATE));
}

export async function listMeetings(userId, query) {
  const { page, limit, skip } = resolvePagination(query, 20);
  const now = new Date();

  const conditions = [
    { $or: [{ host: userId }, { invitees: userId }, { 'participants.user': userId }] },
  ];

  if (query.filter === MeetingListFilter.Upcoming) {
    conditions.push({
      status: { $in: [MeetingStatus.Scheduled, MeetingStatus.Live] },
      scheduledEnd: { $gte: now },
    });
  } else if (query.filter === MeetingListFilter.Past) {
    conditions.push({
      $or: [
        { status: { $in: [MeetingStatus.Ended, MeetingStatus.Cancelled] } },
        { scheduledEnd: { $lt: now } },
      ],
    });
  }

  if (query.search) conditions.push({ title: new RegExp(escapeRegex(query.search), 'i') });
  if (query.from) conditions.push({ scheduledStart: { $gte: new Date(query.from) } });
  if (query.to) conditions.push({ scheduledStart: { $lte: new Date(query.to) } });

  const filter = { $and: conditions };
  // Upcoming reads best soonest-first; history reads best newest-first.
  const sort = query.filter === MeetingListFilter.Upcoming
    ? { scheduledStart: 1 }
    : { scheduledStart: -1 };

  const [docs, total] = await Promise.all([
    Meeting.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Meeting.countDocuments(filter),
  ]);

  return paginated(docs.map(toMeetingDto), total, page, limit);
}

export async function getMeeting(idOrCode, viewerId) {
  const meeting = await findMeeting(idOrCode);
  if (!hasAccess(meeting, viewerId)) {
    throw ApiError.forbidden('You are not part of this meeting');
  }
  return toMeetingDto(meeting);
}

/** Public lookup used by the Join screen before anyone is authenticated. */
export async function lookupMeeting(code) {
  const meeting = await findMeeting(code, { withPasscode: true });
  return {
    meetingId: meeting.meetingId,
    title: meeting.title,
    hostName: meeting.host?.name ?? '',
    hasPasscode: Boolean(meeting.passcodeHash),
    status: meeting.status,
    waitingRoom: meeting.settings.waitingRoom,
  };
}

export async function updateMeeting(idOrCode, userId, input) {
  const meeting = await findMeeting(idOrCode);
  assertHost(meeting, userId);

  if (meeting.status === MeetingStatus.Ended) {
    throw ApiError.badRequest('This meeting has already ended');
  }

  if (input.title !== undefined) meeting.title = input.title;
  if (input.description !== undefined) meeting.description = input.description ?? undefined;
  if (input.scheduledStart) meeting.scheduledStart = new Date(input.scheduledStart);
  if (input.scheduledEnd) meeting.scheduledEnd = new Date(input.scheduledEnd);
  if (meeting.scheduledEnd <= meeting.scheduledStart) {
    throw ApiError.validation('The end time must be after the start time', {
      scheduledEnd: ['The end time must be after the start time'],
    });
  }
  if (input.passcode !== undefined) {
    meeting.passcodeHash = input.passcode ? await hashPassword(input.passcode) : undefined;
  }
  if (input.inviteeIds) meeting.invitees = await validateInvitees(input.inviteeIds);
  if (input.settings) meeting.settings = { ...meeting.settings.toObject(), ...input.settings };
  if (input.recurrence !== undefined) meeting.recurrence = input.recurrence ?? undefined;

  await meeting.save();
  return toMeetingDto(await meeting.populate(POPULATE));
}

export async function startMeeting(idOrCode, userId) {
  const meeting = await findMeeting(idOrCode);
  assertHost(meeting, userId);

  if (meeting.status === MeetingStatus.Ended) {
    throw ApiError.withCode(409, ErrorCode.MeetingEnded, 'This meeting has already ended');
  }

  if (meeting.status !== MeetingStatus.Live) {
    meeting.status = MeetingStatus.Live;
    meeting.startedAt = new Date();
    await meeting.save();
  }

  return toMeetingDto(await meeting.populate(POPULATE));
}

export async function endMeeting(idOrCode, userId) {
  const meeting = await findMeeting(idOrCode);
  assertHostOrCoHost(meeting, userId);

  meeting.status = MeetingStatus.Ended;
  meeting.endedAt = new Date();
  for (const participant of meeting.participants) {
    if (participant.isOnline) {
      participant.isOnline = false;
      participant.socketId = undefined;
      participant.leftAt = new Date();
    }
  }
  await meeting.save();

  await recordAudit({
    actor: userId,
    action: 'meeting.ended',
    targetType: 'Meeting',
    targetId: meeting._id.toString(),
  });

  return toMeetingDto(await meeting.populate(POPULATE));
}

export async function cancelMeeting(idOrCode, userId) {
  const meeting = await findMeeting(idOrCode);
  assertHost(meeting, userId);

  if (meeting.status === MeetingStatus.Live) {
    throw ApiError.badRequest('End the meeting before cancelling it');
  }

  meeting.status = MeetingStatus.Cancelled;
  await meeting.save();
  return toMeetingDto(await meeting.populate(POPULATE));
}

export async function deleteMeeting(idOrCode, userId) {
  const meeting = await findMeeting(idOrCode);
  assertHost(meeting, userId);

  if (meeting.status === MeetingStatus.Live) {
    throw ApiError.badRequest('End the meeting before deleting it');
  }

  await meeting.deleteOne();
  await recordAudit({
    actor: userId,
    action: 'meeting.deleted',
    targetType: 'Meeting',
    targetId: meeting._id.toString(),
  });
}

export async function inviteUsers(idOrCode, userId, inviteeIds) {
  const meeting = await findMeeting(idOrCode);
  assertHostOrCoHost(meeting, userId);

  const invitees = await validateInvitees(inviteeIds);
  const existing = new Set(meeting.invitees.map((invitee) => idOf(invitee)));
  for (const invitee of invitees) {
    if (!existing.has(invitee.toString())) meeting.invitees.push(invitee);
  }

  await meeting.save();
  return toMeetingDto(await meeting.populate(POPULATE));
}

function onlineCount(meeting) {
  return meeting.participants.filter((participant) => participant.isOnline).length;
}

/**
 * Validates the passcode and capacity, then reserves a participant slot and
 * returns a short-lived token the socket connection must present.
 */
export async function joinMeeting(input, user) {
  const meeting = await findMeeting(normalizeMeetingId(input.meetingId), { withPasscode: true });

  if (meeting.status === MeetingStatus.Ended) {
    throw ApiError.withCode(409, ErrorCode.MeetingEnded, 'This meeting has already ended');
  }
  if (meeting.status === MeetingStatus.Cancelled) {
    throw ApiError.withCode(409, ErrorCode.MeetingEnded, 'This meeting was cancelled');
  }

  if (meeting.passcodeHash) {
    const supplied = input.passcode ?? '';
    if (!supplied || !(await verifyPassword(supplied, meeting.passcodeHash))) {
      throw ApiError.withCode(403, ErrorCode.InvalidPasscode, 'That passcode is not correct');
    }
  }

  const userId = user?._id.toString();
  const host = isHost(meeting, userId);

  if (!host && meeting.status !== MeetingStatus.Live && !meeting.settings.joinBeforeHost) {
    throw ApiError.withCode(403, ErrorCode.WaitingRoom, 'The host has not started this meeting yet');
  }

  if (!user && !input.guestName) {
    throw ApiError.badRequest('Enter your name to join as a guest');
  }

  // A signed-in participant who reloads reuses their existing slot.
  let participant = userId
    ? meeting.participants.find((candidate) => sameUser(candidate.user, userId))
    : undefined;

  if (!participant && onlineCount(meeting) >= meeting.settings.maxParticipants) {
    throw ApiError.withCode(
      403,
      ErrorCode.MeetingFull,
      `This meeting is full (${meeting.settings.maxParticipants} participants maximum)`,
    );
  }

  const displayName = user?.name ?? input.guestName ?? 'Guest';
  const media = {
    audioEnabled: input.media?.audioEnabled ?? !meeting.settings.muteParticipantsOnEntry,
    videoEnabled: input.media?.videoEnabled ?? true,
    screenSharing: false,
    handRaised: false,
  };

  if (participant) {
    participant.displayName = displayName;
    participant.media = media;
    participant.leftAt = undefined;
    if (participant.role !== MeetingRole.CoHost) {
      participant.role = host ? MeetingRole.Host : MeetingRole.Participant;
    }
  } else {
    meeting.participants.push({
      user: user?._id,
      guestName: user ? undefined : input.guestName,
      displayName,
      role: host ? MeetingRole.Host : MeetingRole.Participant,
      media,
      isOnline: false,
    });
    participant = meeting.participants[meeting.participants.length - 1];
  }

  // The host joining their own scheduled meeting starts it.
  if (host && meeting.status === MeetingStatus.Scheduled) {
    meeting.status = MeetingStatus.Live;
    meeting.startedAt = new Date();
  }

  const participantId = participant._id;
  await meeting.save();
  await meeting.populate(POPULATE);

  const saved = meeting.participants.id(participantId);
  if (!saved) throw ApiError.internal('Could not register you in this meeting');

  return {
    meeting: toMeetingDto(meeting),
    participant: toParticipantDto(saved),
    joinToken: signJoinToken({
      mid: meeting._id.toString(),
      pid: saved._id.toString(),
      sub: userId ?? null,
      name: displayName,
      role: saved.role,
    }),
    iceServers: iceServers(),
  };
}

export async function listParticipants(idOrCode, viewerId) {
  const meeting = await findMeeting(idOrCode);
  if (!hasAccess(meeting, viewerId)) {
    throw ApiError.forbidden('You are not part of this meeting');
  }
  return meeting.participants.map(toParticipantDto);
}

export async function removeParticipant(idOrCode, userId, participantId) {
  const meeting = await findMeeting(idOrCode);
  assertHostOrCoHost(meeting, userId);

  const participant = meeting.participants.id(participantId);
  if (!participant) throw ApiError.notFound('Participant not found');
  if (participant.role === MeetingRole.Host) {
    throw ApiError.badRequest('The host cannot be removed');
  }

  participant.isOnline = false;
  participant.socketId = undefined;
  participant.leftAt = new Date();
  await meeting.save();

  return { meetingId: meeting._id.toString(), participant: toParticipantDto(participant) };
}

export async function setParticipantRole(idOrCode, userId, participantId, role) {
  const meeting = await findMeeting(idOrCode);
  assertHost(meeting, userId);

  const participant = meeting.participants.id(participantId);
  if (!participant) throw ApiError.notFound('Participant not found');
  if (role === MeetingRole.Host) {
    throw ApiError.badRequest('Transfer of host rights is not supported yet');
  }

  participant.role = role;
  await meeting.save();
  return { meetingId: meeting._id.toString(), participant: toParticipantDto(participant) };
}
