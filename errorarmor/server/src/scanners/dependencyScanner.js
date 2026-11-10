import path from 'node:path';
import { builtinModules } from 'node:module';
import { makeFinding, lineOfIndex } from './common.js';

const CODE = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.vue'];
const BUILTIN = new Set(builtinModules);
const TOOLING = /^(eslint|prettier|@types\/|@vitejs\/|nodemon|vite$|tailwindcss|postcss|autoprefixer|typescript|jest|vitest|mocha|babel|@babel\/|webpack|ts-node|concurrently|cross-env|husky|lint-staged)/;

const pkgName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);

export const dependencyScanner = {
  id: 'dependencies',
  name: 'Dependency scanner',
  stage: 4,
  async run(project) {
    const findings = [];
    const pkgFiles = project.files.filter((f) => f.base === 'package.json');
    const pkgs = pkgFiles.map((f) => ({ f, dir: path.posix.dirname(f.rel), json: project.json(f) })).filter((p) => p.json);
    const owner = (rel) => pkgs.filter((p) => p.dir === '.' || rel.startsWith(p.dir + '/')).sort((a, b) => b.dir.length - a.dir.length)[0];

    const imported = new Map(pkgs.map((p) => [p.f.rel, new Map()]));
    for (const f of project.files.filter((x) => CODE.includes(x.ext))) {
      const own = owner(f.rel);
      if (!own) continue;
      const text = project.text(f);
      const specs = [
        ...text.matchAll(/(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/g),
        ...text.matchAll(/import\s*['"]([^'"]+)['"]/g),
        ...text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g),
        ...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
      ];
      for (const m of specs) {
        const s = m[1];
        if (/^[./#~@]\//.test(s) || s.startsWith('.') || s.startsWith('/') || s.startsWith('node:') || s.startsWith('~') || s.startsWith('#') || s === '@') continue;
        const name = pkgName(s);
        if (BUILTIN.has(name) || BUILTIN.has(s.split('/')[0])) continue;
        const map = imported.get(own.f.rel);
        if (!map.has(name)) map.set(name, { file: f.rel, line: lineOfIndex(text, m.index) });
      }
    }

    for (const p of pkgs) {
      const used = imported.get(p.f.rel);
      const deps = p.json.dependencies || {}, dev = p.json.devDependencies || {};
      const all = new Set([...Object.keys(deps), ...Object.keys(dev), ...Object.keys(p.json.peerDependencies || {}), ...Object.keys(p.json.optionalDependencies || {})]);
      const ancestors = pkgs.filter((q) => q !== p && (q.dir === '.' || p.dir.startsWith(q.dir + '/')));
      for (const [name, where] of used) {
        if (all.has(name) || p.json.name === name || ancestors.some((q) => ({ ...q.json.dependencies, ...q.json.devDependencies })[name])) continue;
        findings.push(makeFinding({
          ruleId: 'DEP-UNDECLARED', checkId: 'dep-declared', category: 'dependency', severity: 'high', confidence: 0.85, verificationStatus: 'static-analysis',
          title: `Package "${name}" is imported but not listed in package.json`, filePath: where.file, line: where.line,
          description: `${where.file} imports "${name}", which is not in dependencies or devDependencies.`, rootCause: 'The package was never installed with --save, or was removed from package.json.',
          why: 'It works only on machines where it happens to be installed; fresh installs and deployments crash with "Cannot find module".',
          suggestedFix: `Run: npm install ${name}`, relatedFiles: [p.f.rel], howToVerify: 'Delete node_modules, run npm install, then start the app.', key: name,
        }));
      }
      for (const name of Object.keys(deps)) {
        if (used.has(name) || TOOLING.test(name)) continue;
        findings.push(makeFinding({
          ruleId: 'DEP-UNUSED', checkId: 'dep-unused', category: 'dependency', severity: 'info', confidence: 0.6, verificationStatus: 'heuristic',
          title: `Dependency "${name}" appears unused`, filePath: p.f.rel, description: 'No import of this package was found in the source files.',
          rootCause: 'It may be left over from earlier work, or used only via config/CLI which static analysis cannot see.', why: 'Unused packages slow installs and widen the attack surface.',
          suggestedFix: `If it is really unused: npm uninstall ${name}`, key: name,
        }));
      }
    }
    const checks = [
      { id: 'dep-declared', name: 'Imported packages are declared', category: 'dependency', skipped: !pkgs.length },
      { id: 'dep-unused', name: 'Unused dependencies', category: 'dependency', skipped: !pkgs.length },
      { id: 'dep-vulns', name: 'Known vulnerable versions', category: 'dependency', skipped: true, note: 'Needs an advisory database (e.g. npm audit); not available in offline scanning' },
    ];
    return { findings, checks, analyzed: 0 };
  },
};
