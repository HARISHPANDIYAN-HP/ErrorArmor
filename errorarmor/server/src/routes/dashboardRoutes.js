import { Router } from 'express';
import mongoose from 'mongoose';
import { Scan } from '../models/Scan.js';
import { Finding } from '../models/Finding.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ok } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const owner = new mongoose.Types.ObjectId(req.userId);
  const since = new Date(Date.now() - 14 * 86400000);
  const [scans, bySeverity, byCategory, latest, recent, timeline] = await Promise.all([
    Scan.find({ owner, status: 'completed' }).select('filesAnalyzed checks').lean(),
    Finding.aggregate([{ $match: { owner, reviewStatus: { $nin: ['false-positive', 'resolved'] } } }, { $group: { _id: '$severity', n: { $sum: 1 } } }]),
    Finding.aggregate([{ $match: { owner, reviewStatus: { $nin: ['false-positive', 'resolved'] } } }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
    Finding.find({ owner, reviewStatus: 'open' }).sort({ createdAt: -1 }).limit(8).select('title severity category filePath line scan createdAt').lean(),
    Scan.find({ owner }).sort({ createdAt: -1 }).limit(5).select('-structure -checks').populate('project', 'name').lean(),
    Scan.aggregate([{ $match: { owner, createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, scans: { $sum: 1 }, findings: { $sum: '$findingsCount' } } }, { $sort: { _id: 1 } }]),
  ]);
  const sev = Object.fromEntries(bySeverity.map((x) => [x._id, x.n]));
  const totalScans = await Scan.countDocuments({ owner });
  ok(res, {
    totals: {
      scans: totalScans,
      filesAnalyzed: scans.reduce((a, s) => a + (s.filesAnalyzed || 0), 0),
      errors: (sev.critical || 0) + (sev.high || 0),
      warnings: (sev.medium || 0) + (sev.low || 0) + (sev.info || 0),
      passedChecks: scans.reduce((a, s) => a + (s.checks || []).filter((c) => c.status === 'passed').length, 0),
    },
    bySeverity: sev, byCategory: Object.fromEntries(byCategory.map((x) => [x._id, x.n])),
    latestFindings: latest, recentScans: recent, timeline: timeline.map((t) => ({ date: t._id, scans: t.scans, findings: t.findings })),
  });
}));

export default router;
