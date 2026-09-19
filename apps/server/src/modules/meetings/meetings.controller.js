import { SocketEvent } from '@vcs/shared';
import { emitToMeeting } from '../../realtime/io.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, noContent, ok } from '../../utils/response.js';
import * as meetingsService from './meetings.service.js';

export const create = asyncHandler(async (req, res) => {
  created(res, await meetingsService.createMeeting(req.user._id, req.body));
});

export const startInstant = asyncHandler(async (req, res) => {
  created(res, await meetingsService.startInstantMeeting(req.user, req.body));
});

export const list = asyncHandler(async (req, res) => {
  ok(res, await meetingsService.listMeetings(req.user._id.toString(), req.query));
});

/** Public: the Join screen shows the title and whether a passcode is needed. */
export const lookup = asyncHandler(async (req, res) => {
  ok(res, await meetingsService.lookupMeeting(req.params.code));
});

export const getOne = asyncHandler(async (req, res) => {
  ok(res, await meetingsService.getMeeting(req.params.id, req.user._id.toString()));
});

export const update = asyncHandler(async (req, res) => {
  const meeting = await meetingsService.updateMeeting(
    req.params.id,
    req.user._id.toString(),
    req.body,
  );
  emitToMeeting(meeting.id, SocketEvent.MeetingUpdated, { meeting });
  ok(res, meeting);
});

export const remove = asyncHandler(async (req, res) => {
  await meetingsService.deleteMeeting(req.params.id, req.user._id.toString());
  noContent(res);
});

export const start = asyncHandler(async (req, res) => {
  ok(res, await meetingsService.startMeeting(req.params.id, req.user._id.toString()));
});

export const end = asyncHandler(async (req, res) => {
  const meeting = await meetingsService.endMeeting(req.params.id, req.user._id.toString());
  emitToMeeting(meeting.id, SocketEvent.MeetingEnded, {
    meetingId: meeting.id,
    reason: 'host_ended',
  });
  ok(res, meeting);
});

export const cancel = asyncHandler(async (req, res) => {
  ok(res, await meetingsService.cancelMeeting(req.params.id, req.user._id.toString()));
});

export const invite = asyncHandler(async (req, res) => {
  ok(
    res,
    await meetingsService.inviteUsers(req.params.id, req.user._id.toString(), req.body.inviteeIds),
  );
});

/** Anyone with the meeting id and passcode may join, signed in or not. */
export const join = asyncHandler(async (req, res) => {
  ok(res, await meetingsService.joinMeeting(req.body, req.user));
});

export const participants = asyncHandler(async (req, res) => {
  ok(res, await meetingsService.listParticipants(req.params.id, req.user._id.toString()));
});

export const removeParticipant = asyncHandler(async (req, res) => {
  const result = await meetingsService.removeParticipant(
    req.params.id,
    req.user._id.toString(),
    req.params.participantId,
  );

  emitToMeeting(result.meetingId, SocketEvent.ParticipantLeft, result);
  ok(res, result.participant);
});

export const setParticipantRole = asyncHandler(async (req, res) => {
  const result = await meetingsService.setParticipantRole(
    req.params.id,
    req.user._id.toString(),
    req.params.participantId,
    req.body.role,
  );

  emitToMeeting(result.meetingId, SocketEvent.ParticipantUpdated, result);
  ok(res, result.participant);
});

export const ice = asyncHandler(async (_req, res) => {
  ok(res, { iceServers: meetingsService.iceServers() });
});
