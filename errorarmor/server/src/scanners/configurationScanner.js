import path from 'node:path';
import { makeFinding, snippetAround, lineOfIndex } from './common.js';

const CODE = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.vue'];
const BUILTIN_ENV = new Set(['NODE_ENV', 'MODE', 'DEV', 'PROD', 'BASE_URL', 'SSR', 'PORT', 'HOME', 'PATH', 'CI']);

export const configurationScanner = {
  id: 'configuration',
  name: 'Configuration scanner',
  stage: 4,
  async run(project) {
    const findings = [];
    const envFiles = project.files.filter((f) => /^\.env(\.|$)/.test(f.base));
    const example = envFiles.filter((f) => /example|sample/.test(f.base));
    const declared = new Set();
    for (const f of example) for (const line of project.text(f).split(/\r?\n/)) { const m = /^\s*([A-Z0-9_]+)\s*=/.exec(line); if (m) declared.add(m[1]); }

    const used = new Map(); // name -> {file,line,vite}
    for (const f of project.files.filter((x) => CODE.includes(x.ext))) {
      const text = project.text(f);
      for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) if (!used.has(m[1])) used.set(m[1], { f, line: lineOfIndex(text, m.index), vite: false });
      for (const m of text.matchAll(/import\.meta\.env\.([A-Z][A-Z0-9_]*)/g)) {
        if (BUILTIN_ENV.has(m[1])) continue;
        if (!/^VITE_/.test(m[1])) findings.push(makeFinding({
          ruleId: 'CONFIG-VITE-PREFIX', checkId: 'config-vite-env', category: 'configuration', severity: 'medium', confidence: 0.9, verificationStatus: 'static-analysis',
          title: `Vite env variable ${m[1]} is missing the VITE_ prefix`, filePath: f.rel, line: lineOfIndex(text, m.index),
          codeSnippet: snippetAround(text, lineOfIndex(text, m.index), 1),
          description: 'Vite only exposes variables starting with VITE_ to browser code, so this value will be undefined.',
          rootCause: 'Variable name does not follow Vite\'s exposure rule.', why: 'Features depending on it silently break in the browser.',
          suggestedFix: `Rename it to VITE_${m[1]} in the code and in your .env files.`, docsUrl: 'https://vitejs.dev/guide/env-and-mode.html', key: m[1],
        }));
        else if (!used.has(m[1])) used.set(m[1], { f, line: lineOfIndex(text, m.index), vite: true });
      }
    }
    const userVars = [...used.entries()].filter(([k]) => !BUILTIN_ENV.has(k));
    if (userVars.length && !example.length) {
      findings.push(makeFinding({
        ruleId: 'CONFIG-NO-ENV-EXAMPLE', checkId: 'config-env-declared', category: 'configuration', severity: 'low', confidence: 0.85, verificationStatus: 'static-analysis',
        title: 'No .env.example documents the environment variables', filePath: userVars[0][1].f.rel, line: userVars[0][1].line,
        description: `The code reads ${userVars.length} environment variable(s) but no .env.example file lists them.`, rootCause: 'Required configuration is undocumented.',
        why: 'New developers and deployments will miss required settings.', suggestedFix: `Create .env.example listing: ${userVars.map(([k]) => k).slice(0, 8).join(', ')}.`,
      }));
    } else if (example.length) {
      for (const [name, info] of userVars) if (!declared.has(name))
        findings.push(makeFinding({
          ruleId: 'CONFIG-MISSING-ENV', checkId: 'config-env-declared', category: 'configuration', severity: 'medium', confidence: 0.8, verificationStatus: 'static-analysis',
          title: `Environment variable ${name} is not declared in .env.example`, filePath: info.f.rel, line: info.line,
          codeSnippet: snippetAround(project.text(info.f), info.line, 1), description: `${name} is used in code but missing from the example env file.`,
          rootCause: 'The example configuration was not updated when the variable was added.', why: 'Deployments without the variable will get undefined values.',
          suggestedFix: `Add ${name}= to .env.example and set it in every environment.`, relatedFiles: example.map((f) => f.rel), key: name,
        }));
    }

    // Committed secrets files & .gitignore
    const gi = project.files.find((f) => f.rel === '.gitignore');
    const realEnv = envFiles.filter((f) => !/example|sample/.test(f.base));
    if (realEnv.length) findings.push(makeFinding({
      ruleId: 'CONFIG-ENV-COMMITTED', checkId: 'config-gitignore', category: 'security', severity: 'high', confidence: 0.8, verificationStatus: 'static-analysis',
      title: 'A real .env file is included in the project', filePath: realEnv[0].rel,
      description: 'Environment files usually hold secrets and should not be shared or committed.', rootCause: 'The .env file was zipped or committed with the source.',
      why: 'Anyone with the archive or repository can read your credentials.', suggestedFix: 'Remove it from the archive, rotate any secrets it held, and add .env to .gitignore.',
    }));
    if (project.files.some((f) => f.base === 'package.json') && (!gi || !/^\/?node_modules\/?$/m.test(project.text(gi))))
      findings.push(makeFinding({
        ruleId: 'CONFIG-GITIGNORE', checkId: 'config-gitignore', category: 'configuration', severity: 'low', confidence: 0.8, verificationStatus: 'static-analysis',
        title: gi ? '.gitignore does not ignore node_modules' : 'No .gitignore file found', filePath: gi?.rel,
        description: 'Dependencies and secrets may end up in version control.', rootCause: 'Missing ignore rules.', why: 'Repositories grow huge and may leak secrets.',
        suggestedFix: 'Add node_modules/, dist/ and .env to .gitignore.',
      }));

    // package.json sanity
    for (const f of project.files.filter((x) => x.base === 'package.json')) {
      const pkg = project.json(f);
      if (!pkg) continue;
      const dir = path.posix.dirname(f.rel);
      const rel = (p) => (dir === '.' ? p : `${dir}/${p}`).replace(/^\.\//, '');
      if (pkg.main && !project.find(rel(pkg.main.replace(/^\.\//, ''))))
        findings.push(makeFinding({
          ruleId: 'CONFIG-PKG-MAIN', checkId: 'config-package', category: 'configuration', severity: 'medium', confidence: 0.85, verificationStatus: 'static-analysis',
          title: `package.json "main" points to a missing file (${pkg.main})`, filePath: f.rel,
          description: 'The entry file declared in package.json was not found in the project.', rootCause: 'File renamed or moved.', why: 'Importing or starting the package fails.',
          suggestedFix: 'Update "main" to the real entry file.', key: pkg.main,
        }));
      if (pkg.scripts && !pkg.scripts.start && !pkg.scripts.dev && !pkg.scripts.build)
        findings.push(makeFinding({
          ruleId: 'CONFIG-PKG-SCRIPTS', checkId: 'config-package', category: 'build', severity: 'info', confidence: 0.7, verificationStatus: 'static-analysis',
          title: 'package.json has no start, dev or build script', filePath: f.rel, description: 'Hosting platforms usually look for these scripts.', rootCause: 'Scripts not defined.',
          why: 'Deployment may not know how to run the app.', suggestedFix: 'Add "start" (and "build" for frontends).',
        }));
      for (const [n, v] of Object.entries({ ...pkg.dependencies })) if (v === '*' || v === 'latest')
        findings.push(makeFinding({
          ruleId: 'CONFIG-PKG-UNPINNED', checkId: 'config-package', category: 'dependency', severity: 'low', confidence: 0.9, verificationStatus: 'static-analysis',
          title: `Dependency ${n} uses version "${v}"`, filePath: f.rel, description: 'Unpinned versions can pull in breaking changes.', rootCause: 'Wildcard version range.',
          why: 'Builds become unreproducible.', suggestedFix: `Pin ${n} to a semver range such as ^1.2.3.`, key: n,
        }));
    }
    const hasPkg = project.files.some((f) => f.base === 'package.json');
    const checks = [
      { id: 'config-env-declared', name: 'Environment variables documented', category: 'configuration', skipped: !userVars.length },
      { id: 'config-vite-env', name: 'Vite env prefix rules', category: 'configuration', skipped: !used.size },
      { id: 'config-gitignore', name: '.gitignore & secret files', category: 'configuration' },
      { id: 'config-package', name: 'package.json sanity', category: 'configuration', skipped: !hasPkg },
    ];
    return { findings, checks, analyzed: 0 };
  },
};
