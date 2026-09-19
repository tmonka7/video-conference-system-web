import { env } from '../../config/env.js';
import { toUserDto } from '../../mappers/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { refreshTokenTtlSeconds } from '../../utils/jwt.js';
import { created, noContent, ok } from '../../utils/response.js';
import * as authService from './auth.service.js';

const REFRESH_COOKIE = 'refreshToken';

function contextOf(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
}

/**
 * The refresh token is also set as an httpOnly cookie, so a browser client can
 * keep it out of JavaScript; other clients use the value in the JSON body.
 */
function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: refreshTokenTtlSeconds() * 1000,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

function readRefreshToken(req) {
  return req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
}

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, contextOf(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  created(res, result);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, contextOf(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  ok(res, result);
});

export const refresh = asyncHandler(async (req, res) => {
  const token = readRefreshToken(req);
  if (!token) throw ApiError.unauthorized('No refresh token supplied');

  const result = await authService.refresh(token, contextOf(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  ok(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(readRefreshToken(req), req.user?._id?.toString());
  clearRefreshCookie(res);
  noContent(res);
});

export const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user._id.toString());
  clearRefreshCookie(res);
  noContent(res);
});

export const me = asyncHandler(async (req, res) => {
  ok(res, toUserDto(req.user));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  ok(res, {
    message: 'If an account exists for that email, a reset link has been sent.',
    ...result,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  ok(res, { message: 'Your password has been reset. Please sign in.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user, req.body);
  clearRefreshCookie(res);
  ok(res, { message: 'Password updated. Please sign in again.' });
});
