import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/** Groups zod issues by dotted field path, ready for form rendering. */
export function zodDetails(error) {
  const details = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/**
 * Parses and REPLACES `body`/`query`/`params` with the validated values, so
 * handlers receive coerced types (numbers, booleans, defaults) rather than the
 * raw strings Express hands over.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // req.query is a getter in newer Express; redefining is the safe way.
        Object.defineProperty(req, 'query', {
          value: schemas.query.parse(req.query),
          configurable: true,
          writable: true,
        });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(ApiError.validation('The submitted data is invalid', zodDetails(error)));
        return;
      }
      next(error);
    }
  };
}
