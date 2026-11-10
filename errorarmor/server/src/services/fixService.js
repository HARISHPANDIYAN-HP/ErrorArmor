import fs from 'node:fs';
import path from 'node:path';
import { discoverProject } from '../scanners/fileDiscovery.js';
import { scannerForRule } from '../scanners/scannerRegistry.js';
import { env } from '../config/environment.js';

function safeResolve(root, rel) {
  const abs = path.resolve(root, rel);
  return abs.startsWith(path.resolve(root) + path.sep) ? abs : null;
}

/** Builds a reviewable diff only. Never writes to the stored project or to anything on the user's machine. */
export function buildProposal(finding, root) {
  const base = { status: 'proposed', createdAt: new Date() };
  const manual = `Manual change recommended: ${finding.suggestedFix || 'see the description.'}${finding.correctedExample ? `\n\nExample:\n${finding.correctedExample}` : ''}`;
  if (!finding.fix || !finding.filePath || !finding.line) return { ...base, diff: '', note: manual };
  const abs = safeResolve(root, finding.filePath);
  if (!abs || !fs.existsSync(abs)) return { ...base, diff: '', note: manual };
  const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  const old = lines[finding.line - 1];
  if (old === undefined) return { ...base, diff: '', note: manual };
  let next = old;
  if (finding.fix.type === 'replace-method') {
    next = old.replace(new RegExp(`\\.${finding.fix.from.toLowerCase()}\\(`), `.${finding.fix.to.toLowerCase()}(`)
      .replace(new RegExp(`(method\\s*:\\s*['"\`])${finding.fix.from}`, 'i'), `$1${finding.fix.to}`);
  } else if (finding.fix.type === 'replace-path') {
    next = old.includes(finding.fix.from) ? old.replace(finding.fix.from, finding.fix.to) : old;
  }
  if (next === old) return { ...base, diff: '', note: `${manual}\n\n(An automatic one-line patch could not be generated safely.)` };
  const diff = [`--- a/${finding.filePath}`, `+++ b/${finding.filePath}`, `@@ -${finding.line},1 +${finding.line},1 @@`, `-${old}`, `+${next}`].join('\n');
  return { ...base, diff, note: 'Review this diff and apply it yourself in your editor. ErrorArmor never modifies your files.' };
}

/** Re-runs only the scanner that produced the finding against the project's current stored snapshot. */
export async function verifyFinding(finding, root) {
  const entry = scannerForRule(finding.ruleId);
  if (!entry) return { stillPresent: true, ran: false, message: 'No scanner is available to re-check this rule.' };
  const project = discoverProject(root, { maxFiles: env.maxFiles });
  const r = await entry.scanner.run(project, {});
  const stillPresent = r.findings.some((f) => f.fingerprint === finding.fingerprint);
  return { ran: true, stillPresent, scanner: entry.scanner.id };
}
