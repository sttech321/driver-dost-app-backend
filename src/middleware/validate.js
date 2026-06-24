import { ApiError } from '../utils/ApiError.js';

/**
 * Validate req[source] against a Zod schema. On success the parsed (and
 * coerced) value replaces req[source]; on failure throws a 400 with details.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    req[source] = result.data;
    next();
  };
