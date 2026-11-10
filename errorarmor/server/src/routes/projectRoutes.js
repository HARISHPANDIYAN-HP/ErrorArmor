import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Project } from '../models/Project.js';
import { Scan } from '../models/Scan.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateIds } from '../middleware/validateRequest.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { env } from '../config/environment.js';
import { AppError, asyncHandler, notFound, ok } from '../utils/errors.js';
import { extractZipSafely, removeDir } from '../utils/safeFileHandling.js';
import { SCAN_OPTIONS } from '../scanners/scannerRegistry.js';
import { deleteProjectData, enqueueScan } from '../services/scanService.js';

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1, fields: 10 } });

const categories = z.preprocess(
  (v) => (v === undefined || v === '' ? undefined : Array.isArray(v) ? v : String(v).split(',')),
  z.array(z.enum(SCAN_OPTIONS)).min(1).optional()
);
const createSchema = z.object({ name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(120), description: z.string().trim().max(1000).optional() });
const scanSchema = z.object({ categories });
const listSchema = z.object({ q: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(12) });

function storeArchive(userId, projectId, file) {
  if (!file) throw new AppError(400, 'Attach a project ZIP file in the "archive" field', 'NO_FILE');
  const dest = path.join(env.storageDir, String(userId), String(projectId));
  const tmp = `${dest}.tmp-${Date.now()}`;
  try {
    const stats = extractZipSafely(file.buffer, tmp, { maxFiles: env.maxFiles, maxUnzippedBytes: env.maxUnzippedMb * 1024 * 1024 });
    removeDir(dest);
    fs.renameSync(tmp, dest);
    return { dest, stats };
  } catch (e) { removeDir(tmp); throw e; }
}

router.post('/', uploadLimiter, upload.single('archive'), validate(createSchema), asyncHandler(async (req, res) => {
  const project = new Project({ owner: req.userId, name: req.body.name, description: req.body.description || '' });
  try {
    const { dest, stats } = storeArchive(req.userId, project._id, req.file);
    project.storagePath = dest;
    project.source = { kind: 'zip-upload', originalName: String(req.file.originalname).slice(0, 200), sizeBytes: req.file.size, extracted: stats.extracted, skippedIgnored: stats.skippedIgnored, skippedUnsupported: stats.skippedUnsupported, skippedLarge: stats.skippedLarge };
    await project.save();
  } catch (e) { removeDir(path.join(env.storageDir, String(req.userId), String(project._id))); throw e; }
  const out = project.toObject(); delete out.storagePath;
  ok(res, { project: out }, 201);
}));

router.get('/', validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { q, page, limit } = req.validatedQuery;
  const filter = { owner: req.userId, ...(q ? { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {}) };
  const [items, total] = await Promise.all([Project.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Project.countDocuments(filter)]);
  ok(res, { projects: items }, 200, { page, limit, total, pages: Math.ceil(total / limit) });
}));

router.get('/:projectId', validateIds('projectId'), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.projectId, owner: req.userId }).lean();
  if (!project) throw notFound('Project');
  ok(res, { project });
}));

router.delete('/:projectId', validateIds('projectId'), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.projectId, owner: req.userId }).select('+storagePath');
  if (!project) throw notFound('Project');
  await deleteProjectData(project);
  ok(res, { deleted: true });
}));

// Start a scan; an optional new archive replaces the stored snapshot (used to verify fixes after you edit your code).
router.post('/:projectId/scans', validateIds('projectId'), uploadLimiter, upload.single('archive'), validate(scanSchema), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.projectId, owner: req.userId }).select('+storagePath');
  if (!project) throw notFound('Project');
  if (req.file) {
    const { dest, stats } = storeArchive(req.userId, project._id, req.file);
    project.storagePath = dest;
    project.source = { ...project.source.toObject?.(), originalName: String(req.file.originalname).slice(0, 200), sizeBytes: req.file.size, extracted: stats.extracted, skippedIgnored: stats.skippedIgnored, skippedUnsupported: stats.skippedUnsupported, skippedLarge: stats.skippedLarge };
    await project.save();
  }
  if (!project.storagePath || !fs.existsSync(project.storagePath)) throw new AppError(409, 'Project files are missing. Upload the project again.', 'FILES_MISSING');
  const user = await User.findById(req.userId).lean();
  const chosen = req.body.categories || user?.preferences?.defaultCategories || SCAN_OPTIONS;
  const scan = await Scan.create({ project: project._id, owner: req.userId, status: 'queued', options: { categories: chosen } });
  enqueueScan(scan._id);
  ok(res, { scan }, 202);
}));

export default router;
