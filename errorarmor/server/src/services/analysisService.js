/**
 * Rule-based analysis layer. External AI providers are NOT wired in this build: every explanation comes from
 * the scanner rules, so nothing here can invent test results. The `aiEnabled` user preference is stored so a
 * provider can be added later behind explicit consent and secret redaction.
 */
export function summarizeScan(scan, findings) {
  const sev = scan.summary?.bySeverity || {};
  const total = findings.length;
  if (!total) return 'No findings were reported by the checks that ran. This does not prove the code is bug-free - skipped checks are listed in the report.';
  const files = {};
  for (const f of findings) if (f.filePath) files[f.filePath] = (files[f.filePath] || 0) + 1;
  const worst = Object.entries(files).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, n]) => `${p} (${n})`);
  const cats = Object.entries(scan.summary?.byCategory || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c} (${n})`);
  return `Found ${total} finding(s): ${sev.critical || 0} critical, ${sev.high || 0} high, ${sev.medium || 0} medium, ${sev.low || 0} low, ${sev.info || 0} informational. ` +
    `Most affected areas: ${cats.join(', ')}. Files to look at first: ${worst.join(', ') || 'n/a'}. ` +
    'Items marked "heuristic" are suspicions that should be confirmed with a test before you change code.';
}
