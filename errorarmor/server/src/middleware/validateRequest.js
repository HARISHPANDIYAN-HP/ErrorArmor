import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.parse(req[source] ?? {});
  if (source === 'query') req.validatedQuery = parsed;
  else req[source] = parsed;
  next();
};

export const validateIds = (...names) => (req, res, next) => {
  for (const n of names) {
    if (!mongoose.isValidObjectId(req.params[n]) || String(req.params[n]).length !== 24)
      throw new AppError(400, `Invalid ${n}`, 'INVALID_ID');
  }
  next();
};
