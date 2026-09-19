import { MeetingStatus, PresenceStatus, UserRole, UserStatus } from '@vcs/shared';
import { toAuditLogDto, toMeetingDto, toUserDto } from '../../mappers/index.js';
import { AuditLog } from '../../models/AuditLog.js';
import { FileAsset } from '../../models/FileAsset.js';
import { Meeting } from '../../models/Meeting.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, resolvePagination, resolveSort } from '../../utils/pagination.js';
import { hashPassword } from '../../utils/password.js';
import { paginated } from '../../utils/response.js';
import { recordAudit } from './audit.service.js';

const DAY_MS = 86_400_000;

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function overview(days = 7) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const trendStart = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    newUsers,
    onlineUsers,
    totalMeetings,
    liveMeetings,
    scheduledToday,
    endedThisWeek,
    durations,
    storage,
    trendRows,
  ] = await Promise.all([
    User.countDocuments({ status: { $ne: UserStatus.Deleted } }),
    User.countDocuments({ status: UserStatus.Active }),
    User.countDocuments({ status: UserStatus.Suspended }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    User.countDocuments({ presence: { $ne: PresenceStatus.Offline } }),
    Meeting.countDocuments({}),
    Meeting.countDocuments({ status: MeetingStatus.Live }),
    Meeting.countDocuments({ scheduledStart: { $gte: todayStart, $lt: todayEnd } }),
    Meeting.countDocuments({ status: MeetingStatus.Ended, endedAt: { $gte: weekAgo } }),
    Meeting.aggregate([
      { $match: { startedAt: { $ne: null }, endedAt: { $ne: null } } },
      { $group: { _id: null, averageMs: { $avg: { $subtract: ['$endedAt', '$startedAt'] } } } },
    ]),
    FileAsset.aggregate([
      { $group: { _id: null, count: { $sum: 1 }, totalBytes: { $sum: '$size' } } },
    ]),
    Meeting.aggregate([
      { $match: { scheduledStart: { $gte: trendStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledStart' } },
          meetings: { $sum: 1 },
          participants: { $sum: { $size: { $ifNull: ['$participants', []] } } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Fill gaps so the dashboard chart has one point per day.
  const byDate = new Map(trendRows.map((row) => [row._id, row]));
  const trend = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = startOfDay(new Date(now.getTime() - offset * DAY_MS)).toISOString().slice(0, 10);
    const row = byDate.get(date);
    trend.push({ date, meetings: row?.meetings ?? 0, participants: row?.participants ?? 0 });
  }

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      newThisWeek: newUsers,
      onlineNow: onlineUsers,
    },
    meetings: {
      total: totalMeetings,
      live: liveMeetings,
      scheduledToday,
      endedThisWeek,
      averageDurationMinutes: Math.round((durations[0]?.averageMs ?? 0) / 60000),
    },
    storage: {
      files: storage[0]?.count ?? 0,
      totalBytes: storage[0]?.totalBytes ?? 0,
    },
    trend,
  };
}

export async function listUsers(query) {
  const { page, limit, skip } = resolvePagination(query, 25);

  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }

  const [docs, total] = await Promise.all([
    User.find(filter).sort(resolveSort(query.sort, { createdAt: -1 })).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return paginated(docs.map(toUserDto), total, page, limit);
}

export async function createUser(actorId, input) {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with that email already exists');

  const user = await User.create({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: await hashPassword(input.password),
    role: input.role ?? UserRole.User,
    emailVerified: true,
  });

  await recordAudit({
    actor: actorId,
    action: 'admin.user_created',
    targetType: 'User',
    targetId: user._id.toString(),
  });

  return toUserDto(user);
}

export async function updateUser(actorId, actorRole, userId, input) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  // Only a super admin may change roles or touch another administrator.
  const touchesPrivilege = input.role !== undefined || user.role !== UserRole.User;
  if (touchesPrivilege && actorRole !== UserRole.SuperAdmin) {
    throw ApiError.forbidden('Only a super admin can change administrator accounts');
  }
  if (userId === actorId && input.status && input.status !== UserStatus.Active) {
    throw ApiError.badRequest('You cannot suspend your own account');
  }

  if (input.name !== undefined) user.name = input.name;
  if (input.role !== undefined) user.role = input.role;
  if (input.emailVerified !== undefined) user.emailVerified = input.emailVerified;
  if (input.status !== undefined) {
    user.status = input.status;
    // Suspending or deleting must also kick the user out of every session.
    if (input.status !== UserStatus.Active) {
      await RefreshToken.deleteMany({ user: user._id });
    }
  }

  await user.save();
  await recordAudit({
    actor: actorId,
    action: 'admin.user_updated',
    targetType: 'User',
    targetId: user._id.toString(),
    metadata: { ...input },
  });

  return toUserDto(user);
}

export async function deleteUser(actorId, userId) {
  if (actorId === userId) throw ApiError.badRequest('You cannot delete your own account');

  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  user.status = UserStatus.Deleted;
  user.email = `deleted+${user._id.toString()}@example.invalid`;
  user.phone = undefined;
  await user.save();

  await RefreshToken.deleteMany({ user: user._id });
  await recordAudit({
    actor: actorId,
    action: 'admin.user_deleted',
    targetType: 'User',
    targetId: userId,
  });
}

export async function listAllMeetings(query) {
  const { page, limit, skip } = resolvePagination(query, 25);

  const filter = {};
  if (query.search) filter.title = new RegExp(escapeRegex(query.search), 'i');
  if (query.from || query.to) {
    filter.scheduledStart = {};
    if (query.from) filter.scheduledStart.$gte = new Date(query.from);
    if (query.to) filter.scheduledStart.$lte = new Date(query.to);
  }

  const [docs, total] = await Promise.all([
    Meeting.find(filter)
      .sort(resolveSort(query.sort, { scheduledStart: -1 }))
      .skip(skip)
      .limit(limit)
      .populate(['host', 'invitees', 'participants.user']),
    Meeting.countDocuments(filter),
  ]);

  return paginated(docs.map(toMeetingDto), total, page, limit);
}

export async function forceEndMeeting(actorId, meetingId) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw ApiError.notFound('Meeting not found');

  meeting.status = MeetingStatus.Ended;
  meeting.endedAt = new Date();
  for (const participant of meeting.participants) {
    participant.isOnline = false;
    participant.socketId = undefined;
  }
  await meeting.save();

  await recordAudit({
    actor: actorId,
    action: 'admin.meeting_force_ended',
    targetType: 'Meeting',
    targetId: meetingId,
  });

  await meeting.populate(['host', 'invitees', 'participants.user']);
  return toMeetingDto(meeting);
}

export async function listAuditLogs(query) {
  const { page, limit, skip } = resolvePagination(query, 50);

  const filter = {};
  if (query.action) filter.action = query.action;
  if (query.actorId) filter.actor = query.actorId;

  const [docs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor'),
    AuditLog.countDocuments(filter),
  ]);

  return paginated(docs.map(toAuditLogDto), total, page, limit);
}
