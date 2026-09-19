import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { zodDetails } from './validate.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
}

function normalize(error) {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return ApiError.validation('The submitted data is invalid', zodDetails(error));
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details = {};
    for (const [field, issue] of Object.entries(error.errors)) {
      details[field] = [issue.message];
    }
    return ApiError.validation('The submitted data is invalid', details);
  }

  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for "${error.path}"`);
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `File is larger than the ${env.MAX_UPLOAD_MB} MB limit`
        : error.message;
    return ApiError.badRequest(message);
  }

  // Duplicate key on a unique index (email, meetingId, contact pair).
  if (error && error.code === 11000) {
    const field = Object.keys(error.keyValue ?? {})[0] ?? 'value';
    return ApiError.conflict(`That ${field} is already in use`);
  }

  return ApiError.internal();
}

// eslint-disable-next-line no-unused-vars -- express identifies error handlers by arity
export function errorHandler(error, req, res, next) {
  const apiError = normalize(error);

  if (apiError.status >= 500) {
    logger.error({ err: error, url: req.originalUrl, method: req.method }, 'Unhandled error');
  } else {
    logger.debug({ code: apiError.code, url: req.originalUrl }, apiError.message);
  }

  res.status(apiError.status).json({
    success: false,
    error: {
      code: apiError.code,
      // Internal details never reach production clients.
      message:
        apiError.status >= 500 && env.isProduction ? 'Something went wrong' : apiError.message,
      details: apiError.details,
      ...(apiError.status >= 500 && !env.isProduction ? { stack: error?.stack } : {}),
    },
  });
}
