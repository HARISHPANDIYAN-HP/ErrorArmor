import { Router } from 'express';
import { z } from 'zod';
import { Scan, STAGES } from '../models/Scan.js';
import { Finding, CATEGORIES, SEVERITIES, VERIFICATION } from '../models/Finding.js';
import { Project } from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateIds } from '../middleware/validateRequest.js';
import { AppError, asyncHandler, notFound, ok } from '../utils/errors.js';
import { deleteScanData, enqueueScan, requestCancel } from '../services/scanService.js';
import { buildReport, renderHtml } from '../services/reportService.js';

const router = Router();
router.use(requireAuth);

const owned = async (req) => {
  const scan = await Scan.findOne({ _id: req.params.scanId, owner: req.userId }).populate('project', 'name technologies').lean();
  if (!scan) throw notFound('Scan');
  return scan;
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listSchema = z.object({
  q: z.string().trim().max(100).optional(), status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']).optional(),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10),
});
router.get('/', validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { q, status, from, to, page, limit } = req.validatedQuery;
  const filter = { owner: req.userId };
  if (status) filter.status = status;
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (q) {
    const ids = await Project.find({ owner: req.userId, name: { $regex: esc(q), $options: 'i' } }).distinct('_id');
    filter.project = { $in: ids };
  }
  const [items, total] = await Promise.all([
    Scan.find(filter).select('-structure -checks').populate('project', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Scan.countDocuments(filter),
  ]);
  ok(res, { scans: items }, 200, { page, limit, total, pages: Math.ceil(total / limit) });
}));

const cmpSchema = z.object({ base: z.string().length(24), head: z.string().length(24) });
router.get('/compare', validate(cmpSchema, 'query'), asyncHandler(async (req, res) => {
  const { base, head } = req.validatedQuery;
  const scans = await Scan.find({ _id: { $in: [base, head] }, owner: req.userId }).select('_id project createdAt').populate('project', 'name').lean();
  if (scans.length !== (base === head ? 1 : 2)) throw notFound('Scan');
  const load = (id) => Finding.find({ scan: id, owner: req.userId }).select('fingerprint title severity category filePath line ruleId').lean();
  const [b, h] = await Promise.all([load(base), load(head)]);
  const bs = new Set(b.map((f) => f.fingerprint)), hs = new Set(h.map((f) => f.fingerprint));
  ok(res, {
    base: scans.find((s) => String(s._id) === base), head: scans.find((s) => String(s._id) === head),
    introduced: h.filter((f) => !bs.has(f.fingerprint)), resolved: b.filter((f) => !hs.has(f.fingerprint)), unchanged: h.filter((f) => bs.has(f.fingerprint)).length,
  });
}));

router.get('/:scanId', validateIds('scanId'), asyncHandler(async (req, res) => ok(res, { scan: await owned(req), stages: STAGES })));

router.get('/:scanId/status', validateIds('scanId'), asyncHandler(async (req, res) => {
  const s = await owned(req);
  const end = s.completedAt ? new Date(s.completedAt) : new Date();
  ok(res, {
    id: String(s._id), status: s.status, stageIndex: s.stageIndex, stages: STAGES, filesDiscovered: s.filesDiscovered, filesAnalyzed: s.filesAnalyzed,
    findingsCount: s.findingsCount, startedAt: s.startedAt, completedAt: s.completedAt, elapsedMs: s.startedAt ? end - new Date(s.startedAt) : 0, errorMessage: s.errorMessage || null,
  });
}));

router.post('/:scanId/cancel', validateIds('scanId'), asyncHandler(async (req, res) => {
  const s = await owned(req);
  if (!['queued', 'running'].includes(s.status)) throw new AppError(409, `A ${s.status} scan cannot be cancelled`, 'INVALID_STATE');
  requestCancel(s._id);
  await Scan.updateOne({ _id: s._id }, { status: 'cancelled', completedAt: new Date() });
  ok(res, { cancelled: true });
}));

router.post('/:scanId/retry', validateIds('scanId'), asyncHandler(async (req, res) => {
  const s = await owned(req);
  if (!['failed', 'cancelled'].includes(s.status)) throw new AppError(409, 'Only failed or cancelled scans can be retried', 'INVALID_STATE');
  await Finding.deleteMany({ scan: s._id });
  await Scan.updateOne({ _id: s._id }, { status: 'queued', stageIndex: 0, errorMessage: null, completedAt: null, findingsCount: 0, filesAnalyzed: 0 });
  enqueueScan(s._id);
  ok(res, { queued: true }, 202);
}));

router.delete('/:scanId', validateIds('scanId'), asyncHandler(async (req, res) => {
  const s = await owned(req);
  if (['queued', 'running'].includes(s.status)) throw new AppError(409, 'Cancel the scan before deleting it', 'INVALID_STATE');
  await deleteScanData([s._id]);
  ok(res, { deleted: true });
}));

const findingsSchema = z.object({
  q: z.string().trim().max(100).optional(), severity: z.enum(SEVERITIES).optional(), category: z.enum(CATEGORIES).optional(),
  verification: z.enum(VERIFICATION).optional(), review: z.enum(['open', 'reviewed', 'false-positive', 'resolved']).optional(),
  group: z.enum(['all', 'api', 'logic', 'security', 'dependency']).default('all'),
  sort: z.enum(['severity', 'file', 'category', 'confidence']).default('severity'),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25),
});
const GROUPS = { api: ['api', 'integration'], logic: ['logic', 'quality'], security: ['security', 'auth'], dependency: ['dependency'] };
router.get('/:scanId/findings', validateIds('scanId'), validate(findingsSchema, 'query'), asyncHandler(async (req, res) => {
  const s = await owned(req);
  const { q, severity, category, verification, review, group, sort, page, limit } = req.validatedQuery;
  const filter = { scan: s._id, owner: req.userId };
  if (severity) filter.severity = severity;
  if (category) filter.category = category;
  if (verification) filter.verificationStatus = verification;
  if (review) filter.reviewStatus = review;
  if (group !== 'all' && !category) filter.category = { $in: GROUPS[group] };
  if (q) filter.$or = [{ title: { $regex: esc(q), $options: 'i' } }, { filePath: { $regex: esc(q), $options: 'i' } }];
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  const [all, total] = await Promise.all([
    Finding.find(filter).select('-feedback -proposedPatch -codeSnippet').lean(),
    Finding.countDocuments(filter),
  ]);
  const cmp = {
    severity: (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || (a.filePath || '').localeCompare(b.filePath || ''),
    file: (a, b) => (a.filePath || '').localeCompare(b.filePath || '') || (a.line || 0) - (b.line || 0),
    category: (a, b) => a.category.localeCompare(b.category) || order.indexOf(a.severity) - order.indexOf(b.severity),
    confidence: (a, b) => b.confidence - a.confidence,
  }[sort];
  const items = all.sort(cmp).slice((page - 1) * limit, page * limit);
  ok(res, { findings: items }, 200, { page, limit, total, pages: Math.ceil(total / limit) });
}));

router.get('/:scanId/summary', validateIds('scanId'), asyncHandler(async (req, res) => {
  const s = await owned(req);
  ok(res, { id: String(s._id), status: s.status, summary: s.summary, checks: s.checks, technologies: s.technologies, structure: s.structure, filesDiscovered: s.filesDiscovered, filesAnalyzed: s.filesAnalyzed, durationMs: s.durationMs, categoriesChecked: s.options?.categories });
}));

async function report(req) {
  const s = await owned(req);
  if (s.status !== 'completed') throw new AppError(409, 'The report is available once the scan has completed', 'INVALID_STATE');
  const findings = await Finding.find({ scan: s._id, owner: req.userId }).lean();
  return buildReport(s, findings, s.project);
}
router.get('/:scanId/report', validateIds('scanId'), asyncHandler(async (req, res) => ok(res, { report: await report(req) })));
router.get('/:scanId/report/export', validateIds('scanId'), asyncHandler(async (req, res) => {
  const format = req.query.format === 'html' ? 'html' : 'json';
  const r = await report(req);
  const name = `errorarmor-${r.project.name.replace(/[^\w.-]+/g, '_').slice(0, 40)}-${r.scan.id.slice(-6)}`;
  res.setHeader('Content-Disposition', `attachment; filename="${name}.${format}"`);
  if (format === 'html') res.type('html').send(renderHtml(r));
  else res.type('json').send(JSON.stringify(r, null, 2));
}));

export default router;
