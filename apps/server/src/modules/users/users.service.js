import { DEFAULT_USER_SETTINGS, UserStatus } from '@vcs/shared';
import { toUserDto, toUserSummary } from '../../mappers/index.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, resolvePagination } from '../../utils/pagination.js';
import { paginated } from '../../utils/response.js';

export async function updateProfile(user, input) {
  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone ?? undefined;
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl ?? undefined;

  await user.save();
  return toUserDto(user);
}

export async function updateSettings(user, input) {
  const current = user.settings?.toObject?.() ?? user.settings ?? {};
  user.settings = { ...DEFAULT_USER_SETTINGS, ...current, ...input };
  user.markModified('settings');
  await user.save();
  return toUserDto(user);
}

export async function setAvatar(user, url) {
  user.avatarUrl = url;
  await user.save();
  return toUserDto(user);
}

/** Powers "Add participants" and the new-chat picker. */
export async function searchUsers(viewerId, query) {
  const { page, limit, skip } = resolvePagination(query, 20);

  const filter = { status: UserStatus.Active, _id: { $ne: viewerId } };
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [docs, total] = await Promise.all([
    User.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return paginated(docs.map(toUserSummary), total, page, limit);
}

export async function getUserById(id) {
  const user = await User.findById(id);
  if (!user || user.status === UserStatus.Deleted) throw ApiError.notFound('User not found');
  return toUserSummary(user);
}

/** Soft delete keeps meeting history and chat attribution intact. */
export async function deactivateSelf(user) {
  user.status = UserStatus.Deleted;
  user.email = `deleted+${user._id.toString()}@example.invalid`;
  user.phone = undefined;
  await user.save();
}
