import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/environment.js';
import { Scan } from '../models/Scan.js';
import { Project } from '../models/Project.js';
import { Finding } from '../models/Finding.js';
import { User } from '../models/User.js';
import { InMemoryQueue } from '../queue/jobQueue.js';
import { runScanPipeline, ScanCancelled } from './pipeline.js';
import { SCANNER_VERSION } from '../scanners/common.js';
import { removeDir } from '../utils/safeFileHandling.js';
import { logger } from '../utils/logger.js';

const cancelled = new Set();

async function processScan(scanId) {
  const scan = await Scan.findById(scanId);
  if (!scan || scan.status === 'cancelled') return;
  const project = await Project.findById(scan.project).select('+storagePath');
  if (!project?.storagePath || !fs.existsSync(project.storagePath)) {
    await Scan.updateOne({ _id: scanId }, { status: 'failed', errorMessage: 'Project files are no longer available. Upload the project again.', completedAt: new Date() });
    return;
  }
  const started = Date.now();
  await Scan.updateOne({ _id: scanId }, { status: 'running', startedAt: new Date(), stageIndex: 0, errorMessage: null, filesAnalyzed: 0, findingsCount: 0 });
  const isCancelled = async () => cancelled.has(String(scanId)) || !!(await Scan.exists({ _id: scanId, status: 'cancelled' }));
  try {
    const out = await runScanPipeline(project.storagePath, {
      categories: scan.options.categories, maxFiles: env.maxFiles, timeoutMs: env.scanTimeoutSec * 1000, isCancelled,
      onStage: (i) => Scan.updateOne({ _id: scanId, status: 'running' }, { stageIndex: i }),
      onProgress: (p) => Scan.updateOne({ _id: scanId, status: 'running' }, p),
    });
    await Scan.updateOne({ _id: scanId, status: 'running' }, { stageIndex: 8 });
    await Finding.deleteMany({ scan: scanId });
    if (out.findings.length)
      await Finding.insertMany(out.findings.map((f) => ({ ...f, scan: scanId, project: scan.project, owner: scan.owner })), { ordered: false });
    await Project.updateOne({ _id: scan.project }, { technologies: [...out.technologies.languages, ...out.technologies.frameworks] });
    await Scan.updateOne({ _id: scanId, status: 'running' }, {
      status: 'completed', completedAt: new Date(), durationMs: Date.now() - started, stageIndex: 9,
      filesDiscovered: out.filesDiscovered, filesAnalyzed: out.filesAnalyzed, findingsCount: out.findings.length,
      technologies: out.technologies, structure: out.structure, summary: out.summary, checks: out.checks,
      scannerVersions: { core: SCANNER_VERSION, acorn: 'acorn', node: process.version },
    });
  } catch (e) {
    if (e instanceof ScanCancelled) { logger.info('Scan cancelled', { scanId }); }
    else {
      logger.error('Scan failed', { scanId, error: e?.message });
      await Scan.updateOne({ _id: scanId, status: { $ne: 'cancelled' } }, { status: 'failed', errorMessage: e?.message || 'Scan failed unexpectedly', completedAt: new Date(), durationMs: Date.now() - started });
    }
  } finally {
    cancelled.delete(String(scanId));
  }
}

export const scanQueue = new InMemoryQueue(processScan, env.queueConcurrency);
export const enqueueScan = (id) => scanQueue.enqueue(id);
export const requestCancel = (id) => cancelled.add(String(id));

export async function recoverInterruptedScans() {
  const r = await Scan.updateMany({ status: { $in: ['queued', 'running'] } }, { status: 'failed', errorMessage: 'The server restarted while this scan was running. Use Retry.', completedAt: new Date() });
  if (r.modifiedCount) logger.warn('Marked interrupted scans as failed', { count: r.modifiedCount });
}

export async function deleteScanData(scanIds) {
  await Finding.deleteMany({ scan: { $in: scanIds } });
  await Scan.deleteMany({ _id: { $in: scanIds } });
}

export async function deleteProjectData(project) {
  const scans = await Scan.find({ project: project._id }).select('_id').lean();
  await deleteScanData(scans.map((s) => s._id));
  const p = project.storagePath || (await Project.findById(project._id).select('+storagePath'))?.storagePath;
  if (p && path.resolve(p).startsWith(env.storageDir)) removeDir(p);
  await Project.deleteOne({ _id: project._id });
}

export async function purgeExpired() {
  const users = await User.find().select('preferences.retentionDays').lean();
  for (const u of users) {
    const days = u.preferences?.retentionDays || 30;
    const cutoff = new Date(Date.now() - days * 86400000);
    const old = await Scan.find({ owner: u._id, createdAt: { $lt: cutoff } }).select('_id').lean();
    if (old.length) await deleteScanData(old.map((s) => s._id));
    const stale = await Project.find({ owner: u._id, createdAt: { $lt: cutoff } }).select('+storagePath').lean();
    for (const p of stale) if (!(await Scan.exists({ project: p._id }))) await deleteProjectData(p);
  }
}
