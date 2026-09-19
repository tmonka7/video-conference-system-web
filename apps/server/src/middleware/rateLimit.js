import rateLimit from 'express-rate-limit';
import { ErrorCode } from '@vcs/shared';
import { env } from '../config/env.js';

function make(options) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Limits would make the test suite flaky and slow.
    skip: () => env.isTest,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: { code: ErrorCode.TooManyRequests, message: 'Too many requests, slow down.' },
      });
    },
    ...options,
  });
}

/** Broad limit applied to the whole API. */
export const apiLimiter = make({ windowMs: 60_000, limit: 300 });

/** Tight limit on credential endpoints to blunt password guessing. */
export const authLimiter = make({ windowMs: 15 * 60_000, limit: 20 });

/** Joining spikes when a scheduled meeting starts, so allow more. */
export const joinLimiter = make({ windowMs: 60_000, limit: 30 });

export const uploadLimiter = make({ windowMs: 60_000, limit: 30 });
