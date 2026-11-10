import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/environment.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong on the server', details;
  if (err instanceof AppError) ({ status, code, message, details } = err);
  else if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Please check the highlighted fields';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err?.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400; code = 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? `Upload too large (limit ${env.maxUploadMb} MB)` : err.message;
  } else if (err?.code === 11000) {
    status = 409; code = 'DUPLICATE'; message = 'That value is already in use';
  } else if (err?.name === 'CastError') {
    status = 400; code = 'INVALID_ID'; message = 'Invalid identifier';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400; code = 'BAD_JSON'; message = 'Request body is not valid JSON';
  }
  if (status >= 500) logger.error(err?.message || 'error', { stack: env.nodeEnv === 'production' ? undefined : err?.stack, path: req.path });
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
}
