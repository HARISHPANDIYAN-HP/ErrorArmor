import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { requireAuth, COOKIE } from '../middleware/auth.js';
import { validate } from '../middleware/validateRequest.js';
import { AppError, asyncHandler, ok } from '../utils/errors.js';
import { SCAN_OPTIONS } from '../scanners/scannerRegistry.js';
import { deleteProjectData } from '../services/scanService.js';
import { publicUser } from './authRoutes.js';

const router = Router();
router.use(requireAuth);

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  preferences: z.object({
    theme: z.enum(['dark', 'light']).optional(),
    defaultCategories: z.array(z.enum(SCAN_OPTIONS)).min(1).optional(),
    aiEnabled: z.boolean().optional(),
    retentionDays: z.number().int().min(1).max(365).optional(),
    languages: z.array(z.string().max(30)).max(10).optional(),
  }).optional(),
});

router.get('/me', asyncHandler(async (req, res) => ok(res, { user: publicUser(await User.findById(req.userId)) })));

router.patch('/me', validate(patchSchema), asyncHandler(async (req, res) => {
  const set = {};
  if (req.body.name) set.name = req.body.name;
  for (const [k, v] of Object.entries(req.body.preferences || {})) set[`preferences.${k}`] = v;
  const user = await User.findByIdAndUpdate(req.userId, { $set: set }, { new: true, runValidators: true });
  ok(res, { user: publicUser(user) });
}));

router.delete('/me', validate(z.object({ password: z.string().min(1) })), asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw new AppError(403, 'Password is incorrect', 'INVALID_CREDENTIALS');
  const projects = await Project.find({ owner: user._id }).select('+storagePath');
  for (const p of projects) await deleteProjectData(p);
  await User.deleteOne({ _id: user._id });
  res.clearCookie(COOKIE, { path: '/' });
  ok(res, { deleted: true });
}));

export default router;
