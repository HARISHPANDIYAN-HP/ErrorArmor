import { Router } from 'express';
import { z } from 'zod';
import { Finding } from '../models/Finding.js';
import { Project } from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateIds } from '../middleware/validateRequest.js';
import { AppError, asyncHandler, notFound, ok } from '../utils/errors.js';
import { buildProposal, verifyFinding } from '../services/fixService.js';

const router = Router();
router.use(requireAuth);

const owned = async (req) => {
  const f = await Finding.findOne({ _id: req.params.findingId, owner: req.userId });
  if (!f) throw notFound('Finding');
  return f;
};
const projectRoot = async (f) => (await Project.findOne({ _id: f.project, owner: f.owner }).select('+storagePath'))?.storagePath;

router.get('/:findingId', validateIds('findingId'), asyncHandler(async (req, res) => ok(res, { finding: (await owned(req)).toObject() })));

router.patch('/:findingId/status', validateIds('findingId'), validate(z.object({ reviewStatus: z.enum(['open', 'reviewed', 'false-positive', 'resolved']) })), asyncHandler(async (req, res) => {
  const f = await owned(req);
  f.reviewStatus = req.body.reviewStatus;
  await f.save();
  ok(res, { finding: f.toObject() });
}));

router.post('/:findingId/feedback', validateIds('findingId'), validate(z.object({ helpful: z.boolean(), comment: z.string().trim().max(500).optional() })), asyncHandler(async (req, res) => {
  const f = await owned(req);
  f.feedback.push({ ...req.body, at: new Date() });
  await f.save();
  ok(res, { recorded: true }, 201);
}));

router.post('/:findingId/propose-fix', validateIds('findingId'), asyncHandler(async (req, res) => {
  const f = await owned(req);
  const root = await projectRoot(f);
  if (!root) throw new AppError(409, 'Project files are no longer available', 'FILES_MISSING');
  f.proposedPatch = buildProposal(f.toObject(), root);
  await f.save();
  ok(res, { proposedPatch: f.proposedPatch });
}));

router.post('/:findingId/verify-fix', validateIds('findingId'), asyncHandler(async (req, res) => {
  const f = await owned(req);
  const root = await projectRoot(f);
  if (!root) throw new AppError(409, 'Project files are no longer available', 'FILES_MISSING');
  const r = await verifyFinding(f.toObject(), root);
  if (r.ran && !r.stillPresent) { f.reviewStatus = 'resolved'; f.verificationStatus = 'resolved'; await f.save(); }
  ok(res, {
    ...r, finding: f.toObject(),
    message: !r.ran ? r.message : r.stillPresent
      ? 'The issue is still detected in the stored project snapshot. If you fixed it locally, start a new scan and upload the updated ZIP.'
      : 'The originating check no longer reports this issue in the current project snapshot. Marked as resolved.',
  });
}));

export default router;
