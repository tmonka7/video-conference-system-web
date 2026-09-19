import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

function sign(payload, secret, expiresIn) {
  return jwt.sign(payload, secret, { expiresIn });
}

/** `{ sub, role, sid }` — sid is the session, so one device can be revoked. */
export function signAccessToken(payload) {
  return sign(payload, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_TTL);
}

export function signRefreshToken(payload) {
  return sign(payload, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_TTL);
}

/** `{ mid, pid, sub, name, role }` — proves the bearer may join one meeting. */
export function signJoinToken(payload) {
  return sign(payload, env.JWT_ACCESS_SECRET, env.JWT_JOIN_TTL);
}

function verify(token, secret, what) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    const expired = error instanceof jwt.TokenExpiredError;
    throw ApiError.unauthorized(
      expired ? `${what} has expired` : `Invalid ${what.toLowerCase()}`,
    );
  }
}

export function verifyAccessToken(token) {
  return verify(token, env.JWT_ACCESS_SECRET, 'Access token');
}

export function verifyRefreshToken(token) {
  return verify(token, env.JWT_REFRESH_SECRET, 'Refresh token');
}

export function verifyJoinToken(token) {
  return verify(token, env.JWT_ACCESS_SECRET, 'Join token');
}

/** Clients use this to schedule a refresh before the access token dies. */
export function accessTokenTtlSeconds() {
  return parseDuration(env.JWT_ACCESS_TTL);
}

export function refreshTokenTtlSeconds() {
  return parseDuration(env.JWT_REFRESH_TTL);
}

export function parseDuration(value) {
  const match = /^(\d+)\s*([smhd])?$/.exec(String(value).trim());
  if (!match) return 900;
  const factor = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * (factor[match[2] ?? 's'] ?? 1);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
