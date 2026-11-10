import path from 'node:path';
import { makeFinding, snippetAround, lineOfIndex, levenshtein } from './common.js';

const CODE_EXT = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.vue'];
const isTest = (rel) => /(^|\/)(tests?|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel);
const NOT_ROUTERS = new Set(['axios', 'http', 'https', 'request', 'client', 'instance', 'supertest', 'fetch', 'map', 'cache', 'headers', 'params', 'searchParams']);
const METHODS = 'get|post|put|patch|delete';

const seg = (p) => p.split('/').filter(Boolean);
const joinPath = (a, b) => '/' + [...seg(a), ...seg(b)].join('/');
const pathsMatch = (a, b) => {
  const x = seg(a), y = seg(b);
  return x.length === y.length && x.every((s, i) => s.startsWith(':') || y[i].startsWith(':') || s === y[i]);
};
const nearMatch = (a, b) => {
  const x = seg(a), y = seg(b);
  if (x.length !== y.length || !x.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i].startsWith(':') || y[i].startsWith(':') || x[i] === y[i]) continue;
    d += levenshtein(x[i], y[i]);
  }
  return d > 0 && d <= 2;
};

function normalizeUrl(raw) {
  let s = raw.slice(1, -1);
  const absolute = /^(\$\{[^}]*\})?https?:\/\//i.test(s) ? /^https?:\/\/([^/]+)/i.exec(s)?.[1] || null : null;
  s = s.replace(/^\$\{[^}]*\}(?=\/)/, '').replace(/^https?:\/\/[^/]+/i, '').replace(/\$\{[^}]*\}/g, ':param');
  s = s.split(/[?#]/)[0];
  if (!s.startsWith('/')) return null;
  return { path: s.replace(/\/+$/, '') || '/', absoluteHost: absolute };
}

function resolveImport(project, fromRel, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  for (const c of [base, `${base}.js`, `${base}.mjs`, `${base}.cjs`, `${base}/index.js`]) if (project.find(c)) return c;
  return null;
}

function extractBackend(project) {
  const routeFiles = project.files.filter((f) => CODE_EXT.includes(f.ext) && !isTest(f.rel) && /\bexpress\b|\bRouter\s*\(/.test(project.text(f)));
  const routes = [], edges = {};
  for (const f of routeFiles) {
    const text = project.text(f);
    const imports = {};
    for (const m of text.matchAll(/import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g)) imports[m[1]] = resolveImport(project, f.rel, m[2]);
    for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g)) imports[m[1]] = resolveImport(project, f.rel, m[2]);
    for (const m of text.matchAll(/\.use\s*\(\s*(['"`])([^'"`]*)\1\s*,([^;]*?)\)\s*;?/g)) {
      const args = m[3];
      const req = /require\(\s*['"]([^'"]+)['"]\s*\)/.exec(args);
      const id = /([A-Za-z_$][\w$]*)\s*$/.exec(args.trim());
      const target = req ? resolveImport(project, f.rel, req[1]) : id ? imports[id[1]] : null;
      if (target && target !== f.rel) (edges[target] ||= []).push({ parent: f.rel, prefix: m[2] });
    }
    const add = (method, p, index) => routes.push({ method: method.toUpperCase(), localPath: p, file: f.rel, line: lineOfIndex(text, index) });
    for (const m of text.matchAll(new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${METHODS}|all)\\s*\\(\\s*(['"\`])(/[^'"\`]*|\\*)\\3`, 'g')))
      if (!NOT_ROUTERS.has(m[1])) add(m[2], m[4], m.index);
    for (const m of text.matchAll(/\.route\(\s*(['"`])(\/[^'"`]*)\1\)([^;]*)/g))
      for (const mm of m[3].matchAll(new RegExp(`\\.(${METHODS})\\s*\\(`, 'g'))) add(mm[1], m[2], m.index);
  }
  const prefixes = (file, seen = new Set()) => {
    if (seen.has(file) || !edges[file]) return [''];
    seen.add(file);
    return edges[file].flatMap((e) => prefixes(e.parent, new Set(seen)).map((p) => joinPath(p, e.prefix)));
  };
  const out = [];
  for (const r of routes) for (const p of prefixes(r.file)) out.push({ ...r, path: joinPath(p, r.localPath) });
  return { routes: out, hasBackend: routeFiles.length > 0, backendText: routeFiles.map((f) => project.text(f)).join('\n') };
}

function extractFrontendCalls(project) {
  const calls = [];
  let baseUrlDeclared = false;
  const files = project.files.filter((f) => CODE_EXT.includes(f.ext) && !isTest(f.rel) && !/\bfrom\s+['"]express['"]|require\(\s*['"]express['"]\s*\)/.test(project.text(f)));
  for (const f of files) {
    const text = project.text(f);
    if (/baseURL\s*:/.test(text)) baseUrlDeclared = true;
    const baseM = /baseURL\s*:\s*(['"`])([^'"`]*)\1/.exec(text);
    const basePath = baseM ? (normalizeUrl(baseM[1] + baseM[2] + baseM[1])?.path ?? '') : '';
    const push = (method, rawUrl, index, via) => {
      const n = normalizeUrl(rawUrl);
      if (!n) return;
      const full = via === 'axios' && basePath && basePath !== '/' && !n.path.startsWith(basePath) ? joinPath(basePath, n.path) : n.path;
      calls.push({ method: method.toUpperCase(), path: full, host: n.absoluteHost, file: f.rel, line: lineOfIndex(text, index), raw: rawUrl, file_ref: f });
    };
    const lit = '(`[^`]*`|\'[^\'\\n]*\'|"[^"\\n]*")';
    for (const m of text.matchAll(new RegExp(`\\b(?:axios|api|http|client|instance|request)\\s*\\.\\s*(${METHODS})\\s*(?:<[^>]*>)?\\s*\\(\\s*${lit}`, 'g'))) push(m[1], m[2], m.index, 'axios');
    for (const m of text.matchAll(new RegExp(`\\bfetch\\s*\\(\\s*${lit}`, 'g'))) {
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 250).split(/\bfetch\s*\(/)[0];
      push((/method\s*:\s*['"`]([A-Za-z]+)['"`]/.exec(after) || [, 'GET'])[1], m[1], m.index, 'fetch');
    }
  }
  return { calls, baseUrlDeclared };
}

export const apiScanner = {
  id: 'api',
  name: 'API & integration scanner',
  stage: 5,
  async run(project) {
    const findings = [];
    const { routes, hasBackend, backendText } = extractBackend(project);
    const { calls, baseUrlDeclared } = extractFrontendCalls(project);
    const matchedRoutes = new Set();
    const seen = new Set();

    const snip = (c) => snippetAround(project.text(c.file_ref), c.line, 1);
    const mk = (c, p) => makeFinding({ category: 'api', filePath: c.file, line: c.line, codeSnippet: snip(c), key: `${p.ruleId}:${c.method}:${c.path}`, ...p });

    for (const c of calls) {
      const sig = `${c.method} ${c.path} ${c.file}:${c.line}`;
      if (seen.has(sig)) continue; seen.add(sig);
      if (!hasBackend || !routes.length) break;
      const same = (r) => pathsMatch(c.path, r.path) || (baseUrlDeclared && seg(r.path).length > seg(c.path).length && pathsMatch(c.path, '/' + seg(r.path).slice(-seg(c.path).length).join('/')));
      const pathHits = routes.filter(same);
      const exact = pathHits.find((r) => r.method === c.method || r.method === 'ALL');
      if (exact) { matchedRoutes.add(`${exact.method} ${exact.path}`); continue; }
      if (pathHits.length) {
        const allowed = [...new Set(pathHits.map((r) => r.method))].join(', ');
        findings.push(mk(c, {
          ruleId: 'API-METHOD-MISMATCH', checkId: 'api-methods', severity: 'high', confidence: 0.85, verificationStatus: 'static-analysis',
          title: `HTTP method mismatch for ${c.path}`, description: `Frontend sends ${c.method} ${c.path}, but the backend only declares ${allowed} for this path.`,
          rootCause: 'The frontend and backend disagree on which HTTP method the endpoint uses.', why: 'The server will answer 404 or 405, so this feature fails at runtime.',
          suggestedFix: `Change the frontend request to ${pathHits[0].method} (or change the backend route to ${c.method}).`,
          relatedFiles: [...new Set(pathHits.map((r) => r.file))],
          howToReproduce: `Run the app and trigger the request: ${c.method} ${c.path}`, howToVerify: `Call the endpoint with ${pathHits[0].method} using curl or a supertest integration test and expect a 2xx.`,
          fix: { type: 'replace-method', from: c.method, to: pathHits[0].method },
        }));
        continue;
      }
      const near = routes.find((r) => nearMatch(c.path, r.path) && (r.method === c.method || r.method === 'ALL'));
      if (near) {
        findings.push(mk(c, {
          ruleId: 'API-ROUTE-MISMATCH', checkId: 'api-routes', severity: 'medium', confidence: 0.8, verificationStatus: 'heuristic',
          title: 'Potential API route mismatch', description: `Frontend calls ${c.method} ${c.path}, but the backend declares ${near.method} ${near.path}.`,
          rootCause: 'The endpoint path differs slightly between frontend and backend (singular/plural or a typo).', why: 'Requests to a path the server does not define return 404.',
          suggestedFix: 'Align the endpoint path on both sides and verify with an integration test.',
          correctedExample: `${c.method === 'GET' ? 'fetch' : 'request'}('${near.path}')`, relatedFiles: [near.file],
          howToReproduce: `Trigger the call and check the network tab for ${c.path}.`, howToVerify: `Request ${near.path} against a running server and confirm the expected response.`,
          fix: { type: 'replace-path', from: c.path, to: near.path },
        }));
        matchedRoutes.add(`${near.method} ${near.path}`);
        continue;
      }
      if (routes.some((r) => seg(r.path)[0] && seg(r.path)[0] === seg(c.path)[0])) {
        findings.push(mk(c, {
          ruleId: 'API-ENDPOINT-NOT-FOUND', checkId: 'api-routes', severity: 'low', confidence: 0.5, verificationStatus: 'heuristic',
          title: `No backend route found for ${c.method} ${c.path}`,
          description: 'No matching Express route was found by static analysis. This may be a false positive if routes are registered dynamically, via a proxy, or by an external service.',
          rootCause: 'The route may be missing, mistyped, or registered in a way static analysis cannot follow.', why: 'If the route really is missing, this request will fail with 404.',
          suggestedFix: 'Confirm the route exists, then align the path. Use an integration test to be sure.', howToVerify: 'Start the backend and call the endpoint directly.',
        }));
      }
    }

    // Frontend-only checks
    const byFile = new Map();
    for (const c of calls) (byFile.get(c.file) || byFile.set(c.file, []).get(c.file)).push(c);
    for (const [file, list] of byFile) {
      const text = project.text(list[0].file_ref);
      if (!/\bcatch\b|\.catch\s*\(/.test(text)) {
        findings.push(makeFinding({
          ruleId: 'API-NO-ERROR-HANDLING', checkId: 'api-error-handling', category: 'api', severity: 'low', confidence: 0.55, verificationStatus: 'heuristic',
          title: 'API requests without visible error handling', filePath: file, line: list[0].line, codeSnippet: snip(list[0]),
          description: `${list.length} API call(s) in this file have no try/catch or .catch().`, rootCause: 'Network and server errors are not handled.',
          why: 'When the server is down or returns an error, users see a blank screen or an unhandled promise rejection.',
          suggestedFix: 'Wrap awaited calls in try/catch (or add .catch) and show an error message.',
          correctedExample: 'try {\n  const res = await api.get("/items");\n} catch (err) {\n  setError(err.message);\n}', key: file,
        }));
      }
    }
    for (const c of calls.filter((x) => x.host && /^(localhost|127\.0\.0\.1)/.test(x.host)).slice(0, 10)) {
      findings.push(mk(c, {
        ruleId: 'API-HARDCODED-URL', checkId: 'api-env-urls', severity: 'low', confidence: 0.9, verificationStatus: 'static-analysis',
        title: 'Hard-coded localhost API URL', description: `The request targets ${c.host} directly.`, rootCause: 'The API origin is typed into the source instead of coming from configuration.',
        why: 'The app works on your machine but breaks after deployment.', suggestedFix: 'Read the base URL from an environment variable (e.g. import.meta.env.VITE_API_URL).',
        correctedExample: 'const API = import.meta.env.VITE_API_URL;\nfetch(`${API}/students`)',
      }));
    }
    if (hasBackend && calls.some((c) => c.host && !/cors|Access-Control-Allow-Origin/i.test(backendText)))
      findings.push(makeFinding({
        ruleId: 'API-CORS-MISSING', checkId: 'api-cors', category: 'api', severity: 'medium', confidence: 0.6, verificationStatus: 'heuristic',
        title: 'Possible CORS configuration issue', filePath: routes[0]?.file, line: routes[0]?.line,
        description: 'The frontend calls the backend using an absolute URL, but no CORS middleware was found in backend code.',
        rootCause: 'Browsers block cross-origin requests unless the server sends CORS headers.', why: 'API calls from the browser will fail with a CORS error.',
        suggestedFix: 'Install and configure the cors package with your frontend origin.', correctedExample: "app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));",
      }));
    let unused = 0;
    if (calls.length) for (const r of routes) {
      if (matchedRoutes.has(`${r.method} ${r.path}`) || r.path === '/' || /health|status|\*/.test(r.path) || unused >= 15) continue;
      if (!calls.some((c) => c.method === r.method && pathsMatch(c.path, r.path))) {
        unused++;
        findings.push(makeFinding({
          ruleId: 'API-UNUSED-ENDPOINT', checkId: 'api-unused', category: 'integration', severity: 'info', confidence: 0.4, verificationStatus: 'heuristic',
          title: `Endpoint ${r.method} ${r.path} is not called by the frontend`, filePath: r.file, line: r.line,
          description: 'No frontend request to this endpoint was found. It may be used by other clients.', rootCause: 'The route may be unused, or the frontend builds the URL dynamically.',
          why: 'Unused endpoints add maintenance cost and attack surface.', suggestedFix: 'Confirm it is needed; remove it or wire it into the frontend.', key: `${r.method} ${r.path}`,
        }));
      }
    }

    const checks = [
      { id: 'api-routes', name: 'Frontend/backend route matching', category: 'api', skipped: !(hasBackend && calls.length), note: !(hasBackend && calls.length) ? 'Needs both Express routes and frontend API calls' : undefined },
      { id: 'api-methods', name: 'HTTP method matching', category: 'api', skipped: !(hasBackend && calls.length) },
      { id: 'api-error-handling', name: 'Error handling around requests', category: 'api', skipped: !calls.length },
      { id: 'api-env-urls', name: 'Environment-based API URLs', category: 'api', skipped: !calls.length },
      { id: 'api-cors', name: 'CORS configuration', category: 'api', skipped: !hasBackend },
      { id: 'api-unused', name: 'Declared but unused endpoints', category: 'integration', skipped: !calls.length },
      { id: 'api-contracts', name: 'Response-field & request-body contracts', category: 'api', skipped: true, note: 'Schema inference is not implemented in this version' },
    ];
    return { findings, checks, analyzed: 0, meta: { routes: routes.length, calls: calls.length } };
  },
};
