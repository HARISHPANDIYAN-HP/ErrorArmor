const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Deduplicates findings, links related ones, summarises, and derives pass/fail for each declared check. */
export function aggregate(results) {
  const byFp = new Map();
  for (const r of results) for (const f of r.findings) if (!byFp.has(f.fingerprint)) byFp.set(f.fingerprint, f);
  const findings = [...byFp.values()].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || (a.filePath || '').localeCompare(b.filePath || ''));

  const byRule = new Map();
  for (const f of findings) (byRule.get(f.ruleId) || byRule.set(f.ruleId, []).get(f.ruleId)).push(f);
  for (const f of findings) {
    const siblings = (byRule.get(f.ruleId) || []).filter((x) => x !== f && x.filePath && x.filePath !== f.filePath).slice(0, 3).map((x) => x.filePath);
    f.relatedFiles = [...new Set([...(f.relatedFiles || []), ...siblings])].slice(0, 6);
  }

  const failed = new Set(findings.map((f) => f.checkId).filter(Boolean));
  const checks = results.flatMap((r) => r.checks).map((c) => ({
    id: c.id, name: c.name, category: c.category, note: c.note,
    status: c.skipped ? 'skipped' : failed.has(c.id) ? 'failed' : 'passed',
  }));

  const count = (key) => findings.reduce((a, f) => ((a[f[key]] = (a[f[key]] || 0) + 1), a), {});
  return { findings, checks, summary: { bySeverity: count('severity'), byCategory: count('category'), byVerification: count('verificationStatus') } };
}
