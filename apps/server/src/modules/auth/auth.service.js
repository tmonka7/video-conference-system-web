import { UserStatus } from '@vcs/shared';
import { logger } from '../../config/logger.js';
import { toUserDto } from '../../mappers/index.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  accessTokenTtlSeconds,
  randomToken,
  refreshTokenTtlSeconds,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { recordAudit } from '../admin/audit.service.js';

/** Issues an access/refresh pair and stores the hashed refresh token. */
async function createSession(user, ctx) {
  const sessionId = randomToken(16);
  const payload = { sub: user._id.toString(), role: user.role, sid: sessionId };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await RefreshToken.create({
    user: user._id,
    sessionId,
    tokenHash: sha256(refreshToken),
    userAgent: ctx.userAgent,
    ip: ctx.ip,
    expiresAt: new Date(Date.now() + refreshTokenTtlSeconds() * 1000),
  });

  return { accessToken, refreshToken, expiresIn: accessTokenTtlSeconds() };
}

function session(user, tokens) {
  return { user: toUserDto(user), tokens };
}

export async function register(input, ctx) {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw ApiError.conflict('An account with that email already exists');

  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
  });

  const tokens = await createSession(user, ctx);
  await recordAudit({ actor: user._id, action: 'auth.register', ip: ctx.ip });
  return session(user, tokens);
}

export async function login(input, ctx) {
  const identifier = input.identifier.trim();
  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
  }).select('+passwordHash');

  // The same message either way, so responses cannot be used to probe for accounts.
  const invalid = ApiError.unauthorized('Email, phone number or password is incorrect');
  if (!user) throw invalid;
  if (!(await verifyPassword(input.password, user.passwordHash))) throw invalid;

  if (user.status === UserStatus.Suspended) {
    throw ApiError.forbidden('This account has been suspended');
  }
  if (user.status === UserStatus.Deleted) throw invalid;

  user.lastSeenAt = new Date();
  await user.save();

  const tokens = await createSession(user, ctx);
  await recordAudit({ actor: user._id, action: 'auth.login', ip: ctx.ip });
  return session(user, tokens);
}

/**
 * Rotates the refresh token: the presented one is consumed and a new pair is
 * issued. Presenting a token that no longer matches the stored hash means it
 * leaked, so every session for that user is revoked.
 */
export async function refresh(token, ctx) {
  const payload = verifyRefreshToken(token);
  const stored = await RefreshToken.findOne({ sessionId: payload.sid });

  if (!stored || stored.tokenHash !== sha256(token)) {
    if (stored) {
      logger.warn({ userId: payload.sub }, 'Refresh token reuse detected; revoking all sessions');
      await RefreshToken.deleteMany({ user: stored.user });
    }
    throw ApiError.unauthorized('Session is no longer valid, please sign in again');
  }

  if (stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthorized('Session has expired, please sign in again');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== UserStatus.Active) {
    throw ApiError.unauthorized('Account is not available');
  }

  await stored.deleteOne();
  const tokens = await createSession(user, ctx);
  return session(user, tokens);
}

export async function logout(token, userId) {
  if (token) {
    await RefreshToken.deleteOne({ tokenHash: sha256(token) });
    return;
  }
  if (userId) await RefreshToken.deleteMany({ user: userId });
}

export async function logoutAll(userId) {
  await RefreshToken.deleteMany({ user: userId });
}

/**
 * Always resolves, so the endpoint cannot be used to discover which emails are
 * registered. The token comes back in the response outside production, where
 * there is no mail transport wired up yet.
 */
export async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) return {};

  const token = randomToken(24);
  user.passwordResetTokenHash = sha256(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  logger.info({ userId: user._id.toString() }, 'Password reset requested');
  return process.env.NODE_ENV === 'production' ? {} : { token };
}

export async function resetPassword(token, password) {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');

  user.passwordHash = await hashPassword(password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  // A password change invalidates every existing session.
  await RefreshToken.deleteMany({ user: user._id });
  await recordAudit({ actor: user._id, action: 'auth.password_reset' });
}

export async function changePassword(user, input) {
  const withHash = await User.findById(user._id).select('+passwordHash');
  if (!withHash) throw ApiError.notFound('Account not found');

  if (!(await verifyPassword(input.currentPassword, withHash.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  withHash.passwordHash = await hashPassword(input.newPassword);
  await withHash.save();

  await RefreshToken.deleteMany({ user: user._id });
  await recordAudit({ actor: user._id, action: 'auth.password_changed' });
}
