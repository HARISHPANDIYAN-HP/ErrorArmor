import jwt from 'jsonwebtoken';
import { env } from '../config/environment.js';
import { AppError } from '../utils/errors.js';

export const COOKIE = 'ea_token';

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: '7d' });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = req.cookies?.[COOKIE] || (h?.startsWith('Bearer ') ? h.slice(7) : null);
  if (!token) throw new AppError(401, 'Please log in to continue', 'UNAUTHENTICATED');
  try {
    req.userId = jwt.verify(token, env.jwtSecret).sub;
  } catch {
    throw new AppError(401, 'Your session has expired. Please log in again', 'UNAUTHENTICATED');
  }
  next();
}
