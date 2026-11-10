import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScanPipeline } from '../services/pipeline.js';

let root, out;
const write = (rel, text) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const rules = () => out.findings.map((f) => f.ruleId);

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ea-fixture-'));
  write('package.json', JSON.stringify({ name: 'demo', dependencies: { express: '^4.0.0', leftpad: '1.0.0' } }));
  write('.gitignore', 'node_modules\n');
  write('.env.example', 'PORT=5000\n');
  write('server/index.js', "import express from 'express';\nimport students from './routes/student.js';\nimport _ from 'lodash';\nconst app = express();\napp.use('/api', students);\nconst key = process.env.API_TOKEN;\nexport default app;\n");
  write('server/routes/student.js', "import { Router } from 'express';\nconst router = Router();\nrouter.get('/student', (req, res) => res.json([]));\nrouter.get('/login', (req, res) => res.json({}));\nexport default router;\n");
  write('client/src/api.js', "export async function load() {\n  const res = await fetch('/api/students');\n  return res.json();\n}\nexport const login = () => axios.post('/api/login', {});\n");
  write('client/src/broken.js', 'const a = {\n  b: 1\n  c: 2\n};\n');
  write('client/src/logic.js', "export function f(a, items) {\n  if (a = 1) { return 1; }\n  if (a === NaN) { return 2; }\n  for (let i = 0; i <= items.length; i++) {}\n  return 3;\n  console.log('never');\n}\n");
  write('server/secrets.js', "const password = 'Sup3rSecretValue99';\nexport default password;\n");
  write('bad.json', '{ "a": 1, }');
  out = await runScanPipeline(root);
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('detects syntax errors with line numbers', () => {
  const f = out.findings.find((x) => x.ruleId === 'SYNTAX-JS');
  assert.ok(f, 'syntax finding expected');
  assert.equal(f.filePath, 'client/src/broken.js');
  assert.equal(f.line, 3);
  assert.ok(rules().includes('SYNTAX-JSON'));
});

test('flags API route and method mismatches', () => {
  const route = out.findings.find((x) => x.ruleId === 'API-ROUTE-MISMATCH');
  assert.ok(route, 'route mismatch expected');
  assert.match(route.description, /\/api\/students/);
  assert.match(route.description, /\/api\/student/);
  const method = out.findings.find((x) => x.ruleId === 'API-METHOD-MISMATCH');
  assert.ok(method, 'method mismatch expected');
  assert.equal(method.fix.to, 'GET');
});

test('flags suspicious logic', () => {
  for (const r of ['LOGIC-ASSIGN-IN-CONDITION', 'LOGIC-NAN-COMPARE', 'LOGIC-OFF-BY-ONE', 'LOGIC-UNREACHABLE']) assert.ok(rules().includes(r), r);
});

test('flags config and dependency problems', () => {
  assert.ok(rules().includes('CONFIG-MISSING-ENV'));
  const undeclared = out.findings.find((x) => x.ruleId === 'DEP-UNDECLARED');
  assert.match(undeclared.title, /lodash/);
  assert.ok(out.findings.some((x) => x.ruleId === 'DEP-UNUSED' && /leftpad/.test(x.title)));
});

test('secrets are detected but never stored in full', () => {
  const s = out.findings.find((x) => x.ruleId === 'SEC-HARDCODED-SECRET');
  assert.ok(s);
  assert.ok(!JSON.stringify(s).includes('Sup3rSecretValue99'));
});

test('skipped checks are reported honestly and every finding has a separate severity and confidence', () => {
  assert.ok(out.checks.some((c) => c.id === 'tests-run' && c.status === 'skipped'));
  assert.ok(out.checks.some((c) => c.id === 'api-contracts' && c.status === 'skipped'));
  for (const f of out.findings) { assert.ok(f.confidence > 0 && f.confidence <= 1); assert.ok(f.severity); assert.ok(f.fingerprint); }
});

test('respects category selection', async () => {
  const only = await runScanPipeline(root, { categories: ['syntax'] });
  assert.ok(only.findings.every((f) => f.ruleId.startsWith('SYNTAX')));
  assert.ok(only.checks.every((c) => c.category === 'syntax' || c.category === 'type'));
});
