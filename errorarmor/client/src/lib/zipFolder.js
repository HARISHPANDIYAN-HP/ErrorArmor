import JSZip from 'jszip';

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '__pycache__', '.cache', '.venv', 'venv', '.idea', '.vscode', 'target', 'out', '.turbo', 'tmp', 'temp']);
const EXT = /\.(jsx?|mjs|cjs|tsx?|json|html|css|vue|py|md|ya?ml|txt|xml|properties|java|sql|sh|toml|env|example|sample)$/i;
const NAMES = new Set(['.env', '.gitignore', 'Dockerfile', '.eslintrc', '.npmrc', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);

export const MAX_UPLOAD_MB = 25;

/** Zips a folder chosen with <input webkitdirectory> in the browser, skipping ignored and unsupported files. */
export async function zipFolder(fileList, onProgress) {
  const files = Array.from(fileList);
  if (!files.length) throw new Error('The selected folder is empty');
  const root = files[0].webkitRelativePath.split('/')[0] || 'project';
  const zip = new JSZip();
  let kept = 0, skipped = 0;
  for (const f of files) {
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split('/');
    const base = parts[parts.length - 1];
    if (parts.slice(0, -1).some((p) => IGNORED.has(p)) || f.size > 1_000_000 || !(NAMES.has(base) || EXT.test(base) || base.startsWith('.env'))) { skipped++; continue; }
    zip.file(rel, f.name.endsWith('lock.json') || base.endsWith('.lock') ? '' : f);
    kept++;
  }
  if (!kept) throw new Error('No supported source files were found in that folder');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, (m) => onProgress?.(Math.round(m.percent)));
  if (blob.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`The compressed project is ${(blob.size / 1048576).toFixed(1)} MB; the limit is ${MAX_UPLOAD_MB} MB`);
  return { file: new File([blob], `${root}.zip`, { type: 'application/zip' }), kept, skipped };
}
