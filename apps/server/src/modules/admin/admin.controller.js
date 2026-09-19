import { SocketEvent } from '@vcs/shared';
import { emitToMeeting } from '../../realtime/io.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, noContent, ok } from '../../utils/response.js';
import * as adminService from './admin.service.js';

export const overview = asyncHandler(async (req, res) => {
  ok(res, await adminService.overview(Number(req.query.days) || 7));
});

export const listUsers = asyncHandler(async (req, res) => {
  ok(res, await adminService.listUsers(req.query));
});

export const createUser = asyncHandler(async (req, res) => {
  created(res, await adminService.createUser(req.user._id.toString(), req.body));
});

export const updateUser = asyncHandler(async (req, res) => {
  ok(
    res,
    await adminService.updateUser(
      req.user._id.toString(),
      req.user.role,
      req.params.id,
      req.body,
    ),
  );
});

export const deleteUser = asyncHandler(async (req, res) => {
  await adminService.deleteUser(req.user._id.toString(), req.params.id);
  noContent(res);
});

export const listMeetings = asyncHandler(async (req, res) => {
  ok(res, await adminService.listAllMeetings(req.query));
});

export const forceEndMeeting = asyncHandler(async (req, res) => {
  const meeting = await adminService.forceEndMeeting(req.user._id.toString(), req.params.id);

  emitToMeeting(meeting.id, SocketEvent.MeetingEnded, {
    meetingId: meeting.id,
    reason: 'host_ended',
  });
  ok(res, meeting);
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  ok(res, await adminService.listAuditLogs(req.query));
});
