import crypto from 'node:crypto';

export const SCANNER_VERSION = '1.0.0';

export function lineOfIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

export function snippetAround(text, line, ctx = 2) {
  const lines = text.split(/\r?\n/);
  const from = Math.max(1, line - ctx), to = Math.min(lines.length, line + ctx);
  const out = [];
  for (let n = from; n <= to; n++) out.push(`${String(n).padStart(4)} ${n === line ? '>' : ' '} ${lines[n - 1].slice(0, 200)}`);
  return out.join('\n');
}

export function redact(value) {
  const s = String(value);
  return s.length <= 6 ? '***' : `${s.slice(0, 2)}${'*'.repeat(6)}[redacted ${s.length} chars]`;
}

/** Builds a finding with consistent defaults. `key` keeps the fingerprint stable across line moves. */
export function makeFinding(p) {
  const f = {
    category: 'quality', severity: 'low', confidence: 0.5, verificationStatus: 'heuristic',
    relatedFiles: [], line: undefined, column: undefined, ...p,
  };
  f.fingerprint = crypto.createHash('sha1').update(`${f.ruleId}|${f.filePath || ''}|${p.key || f.title}`).digest('hex').slice(0, 20);
  delete f.key;
  return f;
}

export const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};
