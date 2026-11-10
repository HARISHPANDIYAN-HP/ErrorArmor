import { summarizeScan } from './analysisService.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Exports omit source snippets so reports never carry credentials or unnecessary code. */
export function buildReport(scan, findings, project) {
  return {
    generatedAt: new Date().toISOString(),
    disclaimer: 'Static analysis cannot find every error. Heuristic findings are suspicions, not confirmed failures.',
    project: { id: String(project._id), name: project.name, technologies: project.technologies },
    scan: {
      id: String(scan._id), status: scan.status, startedAt: scan.startedAt, completedAt: scan.completedAt, durationMs: scan.durationMs,
      filesDiscovered: scan.filesDiscovered, filesAnalyzed: scan.filesAnalyzed, categoriesChecked: scan.options?.categories,
    },
    summary: scan.summary, checks: scan.checks, narrative: summarizeScan(scan, findings),
    findings: findings.map((f) => ({
      id: String(f._id), title: f.title, category: f.category, severity: f.severity, confidence: f.confidence,
      verificationStatus: f.verificationStatus, reviewStatus: f.reviewStatus, filePath: f.filePath, line: f.line, column: f.column,
      description: f.description, rootCause: f.rootCause, suggestedFix: f.suggestedFix, relatedFiles: f.relatedFiles,
    })),
  };
}

export function renderHtml(r) {
  const color = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#94a3b8' };
  const rows = r.findings.map((f) => `<article style="border-left:4px solid ${color[f.severity]};padding:8px 14px;margin:12px 0;background:#f8fafc">
<h3 style="margin:0">${esc(f.title)}</h3>
<p style="margin:4px 0;color:#475569">${esc(f.severity)} · ${esc(f.category)} · confidence ${Math.round(f.confidence * 100)}% · ${esc(f.verificationStatus)}</p>
<p style="margin:4px 0"><code>${esc(f.filePath || '')}${f.line ? ':' + f.line : ''}</code></p>
<p>${esc(f.description)}</p><p><b>Root cause:</b> ${esc(f.rootCause)}</p><p><b>Suggested fix:</b> ${esc(f.suggestedFix)}</p></article>`).join('');
  const checks = (r.checks || []).map((c) => `<li>${esc(c.status.toUpperCase())} - ${esc(c.name)}${c.note ? ` <em>(${esc(c.note)})</em>` : ''}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ErrorArmor report - ${esc(r.project.name)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#0f172a">
<h1>ErrorArmor report: ${esc(r.project.name)}</h1><p>${esc(r.narrative)}</p>
<p>Scan ${esc(r.scan.id)} · ${esc(r.scan.status)} · files analyzed ${r.scan.filesAnalyzed} · generated ${esc(r.generatedAt)}</p>
<p style="color:#64748b">${esc(r.disclaimer)}</p><h2>Checks</h2><ul>${checks}</ul><h2>Findings (${r.findings.length})</h2>${rows || '<p>No findings.</p>'}</body></html>`;
}
