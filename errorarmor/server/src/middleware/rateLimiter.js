import rateLimit from 'express-rate-limit';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs, limit, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } }),
  });

export const apiLimiter = make(15 * 60 * 1000, 600, 'Too many requests. Please slow down.');
export const authLimiter = make(15 * 60 * 1000, 30, 'Too many authentication attempts. Try again later.');
export const uploadLimiter = make(60 * 60 * 1000, 40, 'Upload limit reached. Try again later.');
