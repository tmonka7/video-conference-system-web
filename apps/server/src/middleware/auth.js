import { UserRole, UserStatus } from '@vcs/shared';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';

function readBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  // The web client may keep the access token in a cookie instead.
  return req.cookies?.accessToken ?? null;
}

async function resolveUser(req) {
  const token = readBearerToken(req);
  if (!token) throw ApiError.unauthorized();

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);

  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status === UserStatus.Suspended) {
    throw ApiError.forbidden('This account has been suspended');
  }
  if (user.status === UserStatus.Deleted) {
    throw ApiError.unauthorized('Account no longer exists');
  }

  req.user = user;
  req.sessionId = payload.sid;
}

/** Rejects the request unless a valid access token is present. */
export function authenticate(req, _res, next) {
  resolveUser(req).then(() => next(), next);
}

/** Attaches the user when a token is present, but lets guests through. */
export function optionalAuth(req, _res, next) {
  if (!readBearerToken(req)) {
    next();
    return;
  }
  resolveUser(req).then(
    () => next(),
    () => next(),
  );
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden('This action requires elevated permissions'));
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole(UserRole.Admin, UserRole.SuperAdmin);
export const requireSuperAdmin = requireRole(UserRole.SuperAdmin);
