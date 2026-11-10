import { spawnSync } from 'node:child_process';
import { parseJs } from './jsParser.js';
import { makeFinding, snippetAround } from './common.js';

const JS_EXT = ['.js', '.jsx', '.mjs', '.cjs'];
const LOOSE_JSON = /^(tsconfig|jsconfig)|\.eslintrc|^\.babelrc/;
const PY_SNIPPET = 'import ast,sys\ntry:\n    ast.parse(open(sys.argv[1],encoding="utf-8",errors="replace").read())\nexcept SyntaxError as e:\n    print("%s|%s|%s" % (e.lineno or 1, e.offset or 1, e.msg))';

export const syntaxScanner = {
  id: 'syntax',
  name: 'Syntax scanner',
  stage: 3,
  async run(project) {
    const findings = [];
    let analyzed = 0;

    for (const f of project.byExt(...JS_EXT)) {
      analyzed++;
      const r = parseJs(project, f);
      if (r.error) {
        findings.push(makeFinding({
          ruleId: 'SYNTAX-JS', checkId: 'syntax-js', category: 'syntax', severity: 'high', confidence: 0.98,
          verificationStatus: 'static-analysis', title: `JavaScript syntax error: ${r.error.message}`,
          filePath: f.rel, line: r.error.line, column: r.error.column,
          codeSnippet: snippetAround(project.text(f), r.error.line),
          description: `The JavaScript parser could not read this file: ${r.error.message}.`,
          rootCause: 'A character or keyword is in a place the language does not allow - commonly a missing bracket, comma, quote or parenthesis just before the reported position.',
          why: 'The file cannot run or be bundled until the syntax error is fixed, which usually breaks the whole app or build.',
          suggestedFix: 'Look at the highlighted line and the line above it. Check for unmatched (), {}, [] or quotes and for missing commas between object properties.',
          howToReproduce: `Run: node --check ${f.rel}`, howToVerify: 'Re-run the scan or run the same command; it should print nothing.',
          docsUrl: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Errors/Unexpected_token',
          key: `${r.error.message}`,
        }));
      }
    }

    for (const f of project.byExt('.json')) {
      if (f.base === 'package-lock.json' || LOOSE_JSON.test(f.base)) continue;
      analyzed++;
      const text = project.text(f);
      try { JSON.parse(text); } catch (e) {
        const pos = Number((/position (\d+)/.exec(e.message) || [])[1] || 0);
        const line = text.slice(0, pos).split('\n').length;
        findings.push(makeFinding({
          ruleId: 'SYNTAX-JSON', checkId: 'syntax-json', category: 'syntax', severity: 'high', confidence: 0.99,
          verificationStatus: 'static-analysis', title: 'Invalid JSON file', filePath: f.rel, line,
          codeSnippet: snippetAround(text, line), description: `JSON.parse failed: ${e.message}`,
          rootCause: 'JSON is stricter than JavaScript: no trailing commas, no comments, and keys/strings need double quotes.',
          why: 'Tools such as npm, Vite and your server cannot read an invalid JSON config.',
          suggestedFix: 'Remove trailing commas and comments, and use double quotes for every key and string.',
          howToVerify: 'Paste the file into any JSON validator, or re-run this scan.', key: e.message,
        }));
      }
    }

    // Python syntax via ast.parse in a child process (parses only; never executes uploaded code).
    const pyFiles = project.byExt('.py').slice(0, 200);
    let pyAvailable = false;
    if (pyFiles.length) {
      pyAvailable = spawnSync('python3', ['--version'], { timeout: 4000 }).status === 0;
      if (pyAvailable) for (const f of pyFiles) {
        analyzed++;
        const r = spawnSync('python3', ['-I', '-c', PY_SNIPPET, f.abs], { timeout: 5000, encoding: 'utf8' });
        const out = (r.stdout || '').trim();
        if (out) {
          const [line, col, msg] = out.split('|');
          findings.push(makeFinding({
            ruleId: 'SYNTAX-PY', checkId: 'syntax-python', category: 'syntax', severity: 'high', confidence: 0.98,
            verificationStatus: 'static-analysis', title: `Python syntax error: ${msg}`, filePath: f.rel,
            line: Number(line), column: Number(col), codeSnippet: snippetAround(project.text(f), Number(line)),
            description: `Python could not parse this file: ${msg}.`, rootCause: 'Invalid Python syntax - check indentation, colons and brackets near the reported line.',
            suggestedFix: 'Fix the highlighted line (and the one above it).', key: msg,
          }));
        }
      }
    }

    const checks = [
      { id: 'syntax-js', name: 'JavaScript / JSX syntax', category: 'syntax' },
      { id: 'syntax-json', name: 'JSON validity', category: 'syntax' },
      pyFiles.length
        ? { id: 'syntax-python', name: 'Python syntax', category: 'syntax', skipped: !pyAvailable, note: pyAvailable ? undefined : 'python3 not available on the scan server' }
        : null,
      project.byExt('.ts', '.tsx').length
        ? { id: 'syntax-ts', name: 'TypeScript checks', category: 'type', skipped: true, note: 'TypeScript compiler checks are not implemented in this version' }
        : null,
    ].filter(Boolean);
    return { findings, checks, analyzed };
  },
};
