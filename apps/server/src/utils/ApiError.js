import { ErrorCode } from '@vcs/shared';

/** An error carrying the HTTP status and machine-readable code sent to clients. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, ErrorCode.BadRequest, message, details);
  }

  static validation(message = 'Validation failed', details) {
    return new ApiError(422, ErrorCode.ValidationFailed, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, ErrorCode.Unauthorized, message);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, ErrorCode.Forbidden, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, ErrorCode.NotFound, message);
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(409, ErrorCode.Conflict, message);
  }

  static tooMany(message = 'Too many requests') {
    return new ApiError(429, ErrorCode.TooManyRequests, message);
  }

  static internal(message = 'Something went wrong') {
    return new ApiError(500, ErrorCode.Internal, message);
  }

  static withCode(status, code, message) {
    return new ApiError(status, code, message);
  }
}
