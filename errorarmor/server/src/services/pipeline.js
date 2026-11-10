import { discoverProject, detectTechnologies, buildStructure } from '../scanners/fileDiscovery.js';
import { SCANNERS, SCAN_OPTIONS } from '../scanners/scannerRegistry.js';
import { aggregate } from '../scanners/resultAggregator.js';

export class ScanCancelled extends Error {}

/** Pure scanning pipeline (no database). Static analysis only - uploaded code is never executed here. */
export async function runScanPipeline(root, { categories = SCAN_OPTIONS, maxFiles = 5000, isCancelled = async () => false, onStage = async () => {}, onProgress = async () => {}, timeoutMs = 120000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  await onStage(1);
  const project = discoverProject(root, { maxFiles });
  await onProgress({ filesDiscovered: project.files.length });

  await onStage(2);
  const technologies = detectTechnologies(project);
  const structure = buildStructure(project);

  const results = [];
  let stage = 2, total = 0;
  for (const { option, scanner } of SCANNERS) {
    if (!categories.includes(option)) continue;
    if (await isCancelled()) throw new ScanCancelled();
    if (Date.now() > deadline) throw new Error('Scan exceeded the time limit and was stopped');
    if (scanner.stage !== stage) { stage = scanner.stage; await onStage(stage); }
    const r = await scanner.run(project, {});
    results.push(r);
    total += r.findings.length;
    await onProgress({ filesAnalyzed: project.loaded(), findingsCount: total });
  }
  if (await isCancelled()) throw new ScanCancelled();
  await onStage(7);
  const agg = aggregate(results);
  return { technologies, structure, filesDiscovered: project.files.length, filesAnalyzed: project.loaded(), ...agg };
}
