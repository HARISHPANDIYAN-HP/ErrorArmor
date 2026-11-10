import { makeFinding, snippetAround, lineOfIndex, redact } from './common.js';

const CODE = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.vue', '.py', '.java', '.html'];
const PLACEHOLDER = /(your[_-]|changeme|example|xxx+|<[^>]+>|placeholder|dummy|test|sample|\$\{|process\.env|^\*+$)/i;

const SECRET_RULES = [
  { id: 'SEC-AWS-KEY', re: /\bAKIA[0-9A-Z]{16}\b/g, title: 'AWS access key in source' },
  { id: 'SEC-PRIVATE-KEY', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, title: 'Private key committed to source' },
  { id: 'SEC-DB-URI', re: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s:'"@/]+:([^\s'"@]+)@/g, title: 'Database connection string with password', group: 1 },
  { id: 'SEC-HARDCODED-SECRET', re: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)\w*\s*[:=]\s*['"]([^'"\s]{8,})['"]/gi, title: 'Hard-coded credential', group: 1 },
];

const PATTERNS = [
  { id: 'SEC-EVAL', re: /\beval\s*\(|new\s+Function\s*\(/g, severity: 'high', confidence: 0.75, title: 'Use of eval / new Function',
    rootCause: 'Dynamic code execution runs whatever string it is given.', why: 'If any part of the string comes from users, attackers can run their own code.', fix: 'Avoid eval. Use JSON.parse for data or a lookup table for behaviours.' },
  { id: 'SEC-CMD-INJECTION', re: /\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|[^)]*\+)/g, severity: 'high', confidence: 0.7, title: 'Shell command built from variables',
    rootCause: 'A command string is concatenated with dynamic values.', why: 'Attackers can append their own shell commands.', fix: 'Use execFile/spawn with an argument array and validate inputs.' },
  { id: 'SEC-XSS-INNERHTML', re: /\.innerHTML\s*=|dangerouslySetInnerHTML/g, severity: 'medium', confidence: 0.55, title: 'Raw HTML injection (possible XSS)',
    rootCause: 'HTML is inserted without escaping.', why: 'Untrusted content can run scripts in your users\' browsers.', fix: 'Use textContent or React\'s normal rendering; sanitize with DOMPurify if HTML is required.' },
  { id: 'SEC-NOSQL-INJECTION', re: /\.(?:find|findOne|findOneAndUpdate|updateOne|deleteOne|deleteMany)\s*\(\s*req\.(?:body|query)\s*[,)]/g, severity: 'high', confidence: 0.7, title: 'Request data passed directly into a database query',
    rootCause: 'Raw request objects can contain operators such as {"$ne": null}.', why: 'Attackers can bypass filters or log in without a password.', fix: 'Validate with zod/Joi and pick explicit fields before querying.' },
  { id: 'SEC-SQL-CONCAT', re: /\b(?:query|execute)\s*\(\s*(?:`[^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{|['"][^'"]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^'"]*['"]\s*\+)/gi, severity: 'high', confidence: 0.65, title: 'SQL query built with string concatenation',
    rootCause: 'User input is joined into the SQL text.', why: 'This is the classic SQL injection pattern.', fix: 'Use parameterized queries (placeholders) instead.' },
  { id: 'SEC-PATH-TRAVERSAL', re: /\b(?:sendFile|readFile|readFileSync|createReadStream)\s*\(\s*(?:req\.|`[^`]*\$\{\s*req\.)/g, severity: 'medium', confidence: 0.6, title: 'File path built from request data',
    rootCause: 'User-controlled values choose which file to read.', why: 'Inputs such as ../../etc/passwd can expose server files.', fix: 'Resolve against a fixed directory and reject paths that escape it.' },
  { id: 'SEC-JWT-FALLBACK', re: /process\.env\.\w*(?:SECRET|KEY)\w*\s*(?:\|\||\?\?)\s*['"][^'"]+['"]/g, severity: 'high', confidence: 0.85, title: 'Secret falls back to a hard-coded default',
    rootCause: 'A default string is used when the environment variable is missing.', why: 'If the variable is unset in production, anyone can forge tokens using the public default.', fix: 'Fail at startup when the secret is missing.' },
  { id: 'SEC-CORS-WILDCARD', re: /origin\s*:\s*['"]\*['"]/g, severity: 'low', confidence: 0.7, title: 'CORS allows every origin',
    rootCause: 'Wildcard origin configured.', why: 'Any website can call this API from a browser.', fix: 'Restrict origin to your frontend URL.' },
];

export const securityScanner = {
  id: 'security',
  name: 'Security scanner',
  stage: 6,
  async run(project) {
    const findings = [];
    for (const f of project.files) {
      const isEnv = /^\.env(\.|$)/.test(f.base);
      if (!CODE.includes(f.ext) && !isEnv) continue;
      const text = project.text(f);
      if (!text) continue;
      const exampleEnv = /example|sample/.test(f.base);

      for (const rule of SECRET_RULES) for (const m of text.matchAll(rule.re)) {
        const secret = rule.group ? m[rule.group] : m[0];
        if (!secret || PLACEHOLDER.test(secret) || exampleEnv) continue;
        const line = lineOfIndex(text, m.index);
        const shown = snippetAround(text, line, 0).replace(secret, redact(secret)); // never persist the raw secret
        findings.push(makeFinding({
          ruleId: rule.id, checkId: 'sec-secrets', category: 'security', severity: rule.id === 'SEC-HARDCODED-SECRET' ? 'high' : 'critical', confidence: rule.id === 'SEC-HARDCODED-SECRET' ? 0.7 : 0.9,
          verificationStatus: 'static-analysis', title: rule.title, filePath: f.rel, line, codeSnippet: shown,
          description: `A value that looks like a credential was found (shown redacted: ${redact(secret)}).`, rootCause: 'A secret is written directly in a file that gets shared or committed.',
          why: 'Anyone who can read this file can use the credential. Bots scan public repositories for these within minutes.',
          suggestedFix: 'Move it to an environment variable, rotate the exposed secret, and keep .env out of version control.',
          correctedExample: 'const secret = process.env.API_SECRET;', howToVerify: 'Search the project for the old value and confirm the credential was rotated.', key: `${rule.id}:${line}`,
        }));
      }

      if (!isEnv) for (const p of PATTERNS) for (const m of text.matchAll(p.re)) {
        const line = lineOfIndex(text, m.index);
        if (/^\s*(\/\/|\*|#)/.test(text.split('\n')[line - 1] || '')) continue;
        findings.push(makeFinding({
          ruleId: p.id, checkId: 'sec-patterns', category: 'security', severity: p.severity, confidence: p.confidence, verificationStatus: 'heuristic',
          title: p.title, filePath: f.rel, line, codeSnippet: snippetAround(text, line, 1), description: `${p.title} detected by pattern matching.`,
          rootCause: p.rootCause, why: p.why, suggestedFix: p.fix, howToVerify: 'Review the code path: confirm whether untrusted input can reach this line.', key: `${p.id}:${line}`,
        }));
      }
    }
    // Missing security controls in Express apps
    const pkgs = project.files.filter((f) => f.base === 'package.json').map((f) => project.json(f)).filter(Boolean);
    const deps = new Set(pkgs.flatMap((p) => Object.keys({ ...p.dependencies, ...p.devDependencies })));
    if (deps.has('express') && !deps.has('helmet'))
      findings.push(makeFinding({
        ruleId: 'SEC-NO-HELMET', checkId: 'sec-controls', category: 'security', severity: 'info', confidence: 0.6, verificationStatus: 'heuristic',
        title: 'Express app does not use helmet for security headers', filePath: project.files.find((f) => f.base === 'package.json')?.rel,
        description: 'helmet sets safe default HTTP headers.', rootCause: 'The helmet package is not a dependency.', why: 'Missing headers make clickjacking and sniffing attacks easier.',
        suggestedFix: 'npm install helmet and add app.use(helmet()).',
      }));
    const checks = [
      { id: 'sec-secrets', name: 'Exposed secrets & credentials', category: 'security' },
      { id: 'sec-patterns', name: 'Unsafe code patterns', category: 'security' },
      { id: 'sec-controls', name: 'Security middleware', category: 'security', skipped: !deps.has('express') },
    ];
    return { findings, checks, analyzed: 0 };
  },
};
