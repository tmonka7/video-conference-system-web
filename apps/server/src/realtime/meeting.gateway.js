import {
  ErrorCode,
  MeetingRole,
  MeetingStatus,
  PresenceStatus,
  SocketEvent,
  socketRooms,
} from '@vcs/shared';
import { logger } from '../config/logger.js';
import { toMeetingDto, toParticipantDto } from '../mappers/index.js';
import { Meeting } from '../models/Meeting.js';
import { verifyJoinToken } from '../utils/jwt.js';
import { setPresence } from './presence.js';

const POPULATE = ['host', 'invitees', 'participants.user'];

function fail(socket, code, message, event) {
  socket.emit(SocketEvent.Error, { code, message, event });
}

function loadMeeting(meetingId) {
  return Meeting.findById(meetingId).populate(POPULATE);
}

/**
 * The join token is minted by POST /meetings/join once the passcode and capacity
 * checks pass, so the socket only has to prove it holds one.
 */
async function handleJoin(socket, payload) {
  let claims;
  try {
    claims = verifyJoinToken(payload?.joinToken ?? '');
  } catch {
    fail(
      socket,
      ErrorCode.Unauthorized,
      'Your join token is invalid or has expired',
      SocketEvent.MeetingJoin,
    );
    return;
  }

  const meeting = await loadMeeting(claims.mid);
  if (!meeting) {
    fail(socket, ErrorCode.NotFound, 'That meeting no longer exists', SocketEvent.MeetingJoin);
    return;
  }
  if (meeting.status === MeetingStatus.Ended || meeting.status === MeetingStatus.Cancelled) {
    fail(socket, ErrorCode.MeetingEnded, 'This meeting has already ended', SocketEvent.MeetingJoin);
    return;
  }

  const participant = meeting.participants.id(claims.pid);
  if (!participant) {
    fail(
      socket,
      ErrorCode.NotFound,
      'You are not registered in this meeting',
      SocketEvent.MeetingJoin,
    );
    return;
  }

  // The REST join reserves a slot, but only connected peers consume mesh
  // bandwidth, so the real capacity gate is here.
  const alreadyOnline = meeting.participants.filter(
    (candidate) => candidate.isOnline && !candidate._id.equals(participant._id),
  ).length;

  if (alreadyOnline >= meeting.settings.maxParticipants) {
    fail(
      socket,
      ErrorCode.MeetingFull,
      `This meeting is full (${meeting.settings.maxParticipants} participants maximum)`,
      SocketEvent.MeetingJoin,
    );
    return;
  }

  // A second connection for the same participant replaces the first.
  if (participant.socketId && participant.socketId !== socket.id) {
    socket.to(participant.socketId).emit(SocketEvent.Error, {
      code: ErrorCode.Conflict,
      message: 'You joined this meeting from another tab',
    });
  }

  participant.socketId = socket.id;
  participant.isOnline = true;
  participant.joinedAt = participant.joinedAt ?? new Date();
  participant.leftAt = undefined;
  if (payload?.media) {
    participant.media = { ...participant.media.toObject(), ...payload.media };
  }
  await meeting.save();

  const meetingId = meeting._id.toString();
  socket.data.meetingId = meetingId;
  socket.data.participantId = participant._id.toString();
  socket.data.displayName = participant.displayName;
  await socket.join(socketRooms.meeting(meetingId));

  const peers = meeting.participants.filter(
    (candidate) => candidate.isOnline && !candidate._id.equals(participant._id),
  );

  socket.emit(SocketEvent.MeetingJoined, {
    meeting: toMeetingDto(meeting),
    self: toParticipantDto(participant),
    // The joiner offers to each existing peer; peers wait for the offer.
    peers: peers.map(toParticipantDto),
  });

  socket.to(socketRooms.meeting(meetingId)).emit(SocketEvent.ParticipantJoined, {
    meetingId,
    participant: toParticipantDto(participant),
  });

  if (socket.data.userId) await setPresence(socket.data.userId, PresenceStatus.InMeeting);

  logger.debug(
    { socketId: socket.id, meetingId: meeting.meetingId, peers: peers.length },
    'Participant joined meeting',
  );
}

async function detach(socket, reason) {
  const { meetingId, participantId, userId } = socket.data;
  if (!meetingId || !participantId) return;

  const meeting = await loadMeeting(meetingId);
  const participant = meeting?.participants.id(participantId);

  if (meeting && participant) {
    participant.isOnline = false;
    participant.socketId = undefined;
    participant.leftAt = new Date();
    participant.media = { ...participant.media.toObject(), screenSharing: false, handRaised: false };
    await meeting.save();

    socket.to(socketRooms.meeting(meetingId)).emit(SocketEvent.ParticipantLeft, {
      meetingId,
      participant: toParticipantDto(participant),
    });
  }

  await socket.leave(socketRooms.meeting(meetingId));
  socket.data.meetingId = null;
  socket.data.participantId = null;

  if (userId) await setPresence(userId, PresenceStatus.Online);
  logger.debug({ socketId: socket.id, meetingId, reason }, 'Participant left meeting');
}

/**
 * Signaling messages are addressed to one peer. The sender's socket id is
 * stamped server-side so a client cannot impersonate another participant, and
 * the target must be in the same meeting room.
 */
function relay(socket, event, payload) {
  const meetingId = socket.data.meetingId;
  if (!meetingId) {
    fail(socket, ErrorCode.Forbidden, 'Join a meeting before sending signaling messages', event);
    return;
  }

  const target = socket.nsp.sockets.get(payload?.targetSocketId);
  if (!target || target.data.meetingId !== meetingId) {
    fail(socket, ErrorCode.NotFound, 'That participant is no longer connected', event);
    return;
  }

  target.emit(event, { ...payload, fromSocketId: socket.id });
}

async function handleMediaUpdate(socket, payload) {
  const { meetingId, participantId } = socket.data;
  if (!meetingId || !participantId) return;

  const meeting = await loadMeeting(meetingId);
  const participant = meeting?.participants.id(participantId);
  if (!meeting || !participant) return;

  const wasSharing = participant.media.screenSharing;
  participant.media = { ...participant.media.toObject(), ...(payload?.media ?? {}) };

  const isHostLike =
    participant.role === MeetingRole.Host || participant.role === MeetingRole.CoHost;

  if (participant.media.screenSharing && !meeting.settings.allowParticipantScreenShare && !isHostLike) {
    participant.media.screenSharing = false;
    fail(
      socket,
      ErrorCode.Forbidden,
      'The host has disabled screen sharing',
      SocketEvent.MediaUpdate,
    );
  }

  await meeting.save();

  const event = { meetingId, participant: toParticipantDto(participant) };
  socket.nsp.to(socketRooms.meeting(meetingId)).emit(SocketEvent.ParticipantUpdated, event);

  if (event.participant.media.screenSharing !== wasSharing) {
    socket.nsp
      .to(socketRooms.meeting(meetingId))
      .emit(
        event.participant.media.screenSharing
          ? SocketEvent.ScreenShareStarted
          : SocketEvent.ScreenShareStopped,
        event,
      );
  }
}

/** Resolves the caller's own participant row and checks they run the meeting. */
async function withHostRights(socket, event) {
  const { meetingId, participantId } = socket.data;
  if (!meetingId || !participantId) {
    fail(socket, ErrorCode.Forbidden, 'Join the meeting first', event);
    return null;
  }

  const meeting = await loadMeeting(meetingId);
  const self = meeting?.participants.id(participantId);
  if (!meeting || !self) {
    fail(socket, ErrorCode.NotFound, 'Meeting not found', event);
    return null;
  }

  if (self.role !== MeetingRole.Host && self.role !== MeetingRole.CoHost) {
    fail(socket, ErrorCode.Forbidden, 'Only the host can do that', event);
    return null;
  }

  return { meeting, self };
}

async function handleHostMute(socket, payload) {
  const context = await withHostRights(socket, SocketEvent.HostMuteParticipant);
  if (!context) return;

  const target = context.meeting.participants.id(payload?.participantId);
  if (!target) return;

  target.media = { ...target.media.toObject(), audioEnabled: false };
  await context.meeting.save();

  const meetingId = context.meeting._id.toString();
  socket.nsp.to(socketRooms.meeting(meetingId)).emit(SocketEvent.ParticipantUpdated, {
    meetingId,
    participant: toParticipantDto(target),
  });
}

async function handleHostRemove(socket, payload) {
  const context = await withHostRights(socket, SocketEvent.HostRemoveParticipant);
  if (!context) return;

  const target = context.meeting.participants.id(payload?.participantId);
  if (!target || target.role === MeetingRole.Host) return;

  const targetSocketId = target.socketId;
  target.isOnline = false;
  target.socketId = undefined;
  target.leftAt = new Date();
  await context.meeting.save();

  const meetingId = context.meeting._id.toString();
  socket.nsp.to(socketRooms.meeting(meetingId)).emit(SocketEvent.ParticipantLeft, {
    meetingId,
    participant: toParticipantDto(target),
  });

  const targetSocket = targetSocketId ? socket.nsp.sockets.get(targetSocketId) : null;
  if (targetSocket) {
    targetSocket.emit(SocketEvent.MeetingEnded, { meetingId, reason: 'host_ended' });
    await targetSocket.leave(socketRooms.meeting(meetingId));
    targetSocket.data.meetingId = null;
    targetSocket.data.participantId = null;
  }
}

async function handleHostPromote(socket, payload) {
  const context = await withHostRights(socket, SocketEvent.HostPromote);
  if (!context) return;
  if (context.self.role !== MeetingRole.Host) {
    fail(socket, ErrorCode.Forbidden, 'Only the host can change roles', SocketEvent.HostPromote);
    return;
  }

  const target = context.meeting.participants.id(payload?.participantId);
  if (!target || payload?.role === MeetingRole.Host) return;

  target.role = payload.role;
  await context.meeting.save();

  const meetingId = context.meeting._id.toString();
  socket.nsp.to(socketRooms.meeting(meetingId)).emit(SocketEvent.ParticipantUpdated, {
    meetingId,
    participant: toParticipantDto(target),
  });
}

async function handleHostEnd(socket) {
  const context = await withHostRights(socket, SocketEvent.HostEndMeeting);
  if (!context) return;

  const { meeting } = context;
  meeting.status = MeetingStatus.Ended;
  meeting.endedAt = new Date();
  for (const participant of meeting.participants) {
    participant.isOnline = false;
    participant.socketId = undefined;
    participant.leftAt = participant.leftAt ?? new Date();
  }
  await meeting.save();

  const meetingId = meeting._id.toString();
  const room = socketRooms.meeting(meetingId);
  socket.nsp.to(room).emit(SocketEvent.MeetingEnded, { meetingId, reason: 'host_ended' });

  for (const socketId of socket.nsp.adapter.rooms.get(room) ?? []) {
    const member = socket.nsp.sockets.get(socketId);
    if (!member) continue;
    await member.leave(room);
    member.data.meetingId = null;
    member.data.participantId = null;
  }
}

export function registerMeetingHandlers(socket) {
  /** Wraps an async handler so a rejection becomes an error event, not a crash. */
  const guard = (handler, event) => (payload) => {
    Promise.resolve(handler(payload)).catch((error) => {
      logger.error({ err: error, event, socketId: socket.id }, 'Socket handler failed');
      fail(socket, ErrorCode.Internal, 'Something went wrong', event);
    });
  };

  socket.on(
    SocketEvent.MeetingJoin,
    guard((payload) => handleJoin(socket, payload), SocketEvent.MeetingJoin),
  );
  socket.on(
    SocketEvent.MeetingLeave,
    guard(() => detach(socket, 'left'), SocketEvent.MeetingLeave),
  );

  socket.on(SocketEvent.RtcOffer, (payload) => relay(socket, SocketEvent.RtcOffer, payload));
  socket.on(SocketEvent.RtcAnswer, (payload) => relay(socket, SocketEvent.RtcAnswer, payload));
  socket.on(SocketEvent.RtcCandidate, (payload) =>
    relay(socket, SocketEvent.RtcCandidate, payload),
  );

  socket.on(
    SocketEvent.MediaUpdate,
    guard((payload) => handleMediaUpdate(socket, payload), SocketEvent.MediaUpdate),
  );

  socket.on(
    SocketEvent.HostMuteParticipant,
    guard((payload) => handleHostMute(socket, payload), SocketEvent.HostMuteParticipant),
  );
  socket.on(
    SocketEvent.HostRemoveParticipant,
    guard((payload) => handleHostRemove(socket, payload), SocketEvent.HostRemoveParticipant),
  );
  socket.on(
    SocketEvent.HostPromote,
    guard((payload) => handleHostPromote(socket, payload), SocketEvent.HostPromote),
  );
  socket.on(
    SocketEvent.HostEndMeeting,
    guard(() => handleHostEnd(socket), SocketEvent.HostEndMeeting),
  );

  socket.on('disconnect', () => {
    detach(socket, 'disconnected').catch((error) => {
      logger.error({ err: error, socketId: socket.id }, 'Failed to clean up on disconnect');
    });
  });
}
