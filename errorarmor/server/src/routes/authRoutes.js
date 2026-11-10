import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { validate } from '../middleware/validateRequest.js';
import { requireAuth, signToken, setAuthCookie, COOKIE } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { AppError, asyncHandler, ok } from '../utils/errors.js';

const router = Router();
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100)
    .regex(/[A-Za-z]/, 'Include at least one letter').regex(/\d/, 'Include at least one number'),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address'), password: z.string().min(1, 'Password is required') });

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, preferences: u.preferences, createdAt: u.createdAt });

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  if (await User.exists({ email: req.body.email })) throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
  const user = await User.create({ name: req.body.name, email: req.body.email, passwordHash: await bcrypt.hash(req.body.password, 12) });
  setAuthCookie(res, signToken(user._id));
  ok(res, { user: publicUser(user) }, 201);
}));

router.post('/login', authLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  const valid = await bcrypt.compare(req.body.password, user?.passwordHash || DUMMY_HASH);
  if (!user || !valid) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  setAuthCookie(res, signToken(user._id));
  ok(res, { user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  ok(res, { loggedOut: true });
});

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new AppError(401, 'Account no longer exists', 'UNAUTHENTICATED');
  ok(res, { user: publicUser(user) });
}));

export default router;
export { publicUser };
