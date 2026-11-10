import fs from 'node:fs';
import path from 'node:path';
import { IGNORED_DIRS } from '../utils/safeFileHandling.js';

const TEXT_LIMIT = 1_000_000;

/** Walks a project directory (no symlinks, ignored dirs skipped) and returns a lazy-reading project object. */
export function discoverProject(root, { maxFiles = 5000 } = {}) {
  const files = [];
  const walk = (dir) => {
    if (files.length >= maxFiles) return;
    let items;
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of items) {
      if (it.isSymbolicLink()) continue;
      const abs = path.join(dir, it.name);
      if (it.isDirectory()) { if (!IGNORED_DIRS.has(it.name)) walk(abs); continue; }
      if (!it.isFile() || files.length >= maxFiles) continue;
      const rel = path.relative(root, abs).split(path.sep).join('/');
      files.push({ rel, abs, base: it.name, ext: path.extname(it.name).toLowerCase(), size: fs.statSync(abs).size });
    }
  };
  walk(root);

  const cache = new Map();
  const project = {
    root, files,
    text(f) {
      if (!cache.has(f.abs)) {
        try { cache.set(f.abs, f.size > TEXT_LIMIT ? '' : fs.readFileSync(f.abs, 'utf8')); } catch { cache.set(f.abs, ''); }
      }
      return cache.get(f.abs);
    },
    byExt: (...exts) => files.filter((f) => exts.includes(f.ext)),
    find: (rel) => files.find((f) => f.rel === rel),
    json(f) { try { return JSON.parse(project.text(f)); } catch { return null; } },
    parseCache: new Map(),
    loaded: () => cache.size,
  };
  return project;
}

const FRAMEWORKS = {
  react: 'React', vue: 'Vue', next: 'Next.js', express: 'Express', fastify: 'Fastify', koa: 'Koa', mongoose: 'Mongoose',
  vite: 'Vite', tailwindcss: 'Tailwind CSS', axios: 'Axios', sequelize: 'Sequelize', prisma: 'Prisma', '@angular/core': 'Angular',
  svelte: 'Svelte', typescript: 'TypeScript', jest: 'Jest', vitest: 'Vitest',
};

export function detectTechnologies(project) {
  const languages = new Set(), frameworks = new Set(), manifests = [];
  const extLang = { '.js': 'JavaScript', '.jsx': 'JavaScript (JSX)', '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript (TSX)', '.py': 'Python', '.java': 'Java', '.html': 'HTML', '.css': 'CSS', '.vue': 'Vue SFC' };
  for (const f of project.files) {
    if (extLang[f.ext]) languages.add(extLang[f.ext]);
    if (f.base === 'package.json') {
      manifests.push(f.rel);
      const pkg = project.json(f);
      for (const name of Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies })) if (FRAMEWORKS[name]) frameworks.add(FRAMEWORKS[name]);
    }
    if (['requirements.txt', 'pyproject.toml', 'pom.xml', 'build.gradle'].includes(f.base)) manifests.push(f.rel);
  }
  return { languages: [...languages].sort(), frameworks: [...frameworks].sort(), manifests };
}

export function buildStructure(project) {
  const byExtension = {}, dirs = {};
  for (const f of project.files) {
    byExtension[f.ext || f.base] = (byExtension[f.ext || f.base] || 0) + 1;
    const top = f.rel.includes('/') ? f.rel.split('/')[0] : '(root)';
    dirs[top] = (dirs[top] || 0) + 1;
  }
  const topDirs = Object.entries(dirs).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, count]) => ({ name, count }));
  return { totalFiles: project.files.length, byExtension, topDirs };
}
