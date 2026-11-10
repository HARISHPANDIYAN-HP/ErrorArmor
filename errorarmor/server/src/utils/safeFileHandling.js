import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { AppError } from './errors.js';

export const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '__pycache__', '.cache', '.venv',
  'venv', '.idea', '.vscode', 'target', 'out', '.turbo', '__MACOSX', 'tmp', 'temp',
]);
export const SUPPORTED_EXT = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.html', '.css', '.vue', '.py', '.md', '.yml', '.yaml',
  '.txt', '.xml', '.properties', '.java', '.sql', '.sh', '.toml', '.env', '.example', '.sample',
]);
export const SUPPORTED_BASENAMES = new Set(['.env', '.env.example', '.env.sample', '.gitignore', 'Dockerfile', '.eslintrc', '.npmrc']);
export const LOCKFILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);

export const isSupportedFile = (base) =>
  SUPPORTED_BASENAMES.has(base) || SUPPORTED_EXT.has(path.extname(base).toLowerCase()) || base.startsWith('.env');

export function isSafeEntryPath(name) {
  if (!name || name.length > 300 || name.includes('\0') || name.includes('\\')) return false;
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return false;
  return !name.split('/').some((p) => p === '..');
}

/** Extracts a ZIP buffer into dest with zip-slip, zip-bomb, symlink and file-count protections. */
export function extractZipSafely(buf, dest, { maxFiles, maxUnzippedBytes, maxFileBytes = 1_000_000 }) {
  if (!buf || buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50)
    throw new AppError(400, 'That file is not a valid ZIP archive', 'INVALID_ZIP');
  let zip;
  try { zip = new AdmZip(buf); } catch { throw new AppError(400, 'The ZIP archive is corrupted or unreadable', 'INVALID_ZIP'); }
  const entries = zip.getEntries();
  if (entries.length > maxFiles * 6) throw new AppError(413, 'Archive contains too many entries', 'TOO_MANY_FILES');

  const root = path.resolve(dest);
  fs.mkdirSync(root, { recursive: true });
  const stats = { extracted: 0, skippedIgnored: 0, skippedUnsupported: 0, skippedLarge: 0, totalBytes: 0 };

  for (const e of entries) {
    if (e.isDirectory) continue;
    const name = e.entryName;
    if (!isSafeEntryPath(name)) throw new AppError(400, `Unsafe path found in archive: "${name.slice(0, 60)}"`, 'UNSAFE_ARCHIVE');
    if (((e.attr >>> 16) & 0o170000) === 0o120000) { stats.skippedUnsupported++; continue; } // symlink
    const parts = name.split('/');
    if (parts.slice(0, -1).some((p) => IGNORED_DIRS.has(p))) { stats.skippedIgnored++; continue; }
    const base = parts[parts.length - 1];
    const target = path.resolve(root, name);
    if (!target.startsWith(root + path.sep)) throw new AppError(400, 'Archive path escapes the target folder', 'UNSAFE_ARCHIVE');

    const isLock = LOCKFILES.has(base);
    if (!isLock && !isSupportedFile(base)) { stats.skippedUnsupported++; continue; }
    if (stats.extracted >= maxFiles) throw new AppError(413, `Too many files (limit ${maxFiles})`, 'TOO_MANY_FILES');
    if (!isLock && e.header.size > maxFileBytes) { stats.skippedLarge++; continue; }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (isLock) { fs.writeFileSync(target, ''); stats.extracted++; continue; } // keep presence only
    const data = e.getData();
    if (data.length > maxFileBytes) { stats.skippedLarge++; continue; }
    stats.totalBytes += data.length;
    if (stats.totalBytes > maxUnzippedBytes) throw new AppError(413, 'Archive expands to too much data', 'ZIP_BOMB');
    fs.writeFileSync(target, data);
    stats.extracted++;
  }
  if (stats.extracted === 0)
    throw new AppError(422, 'No supported source files were found in this archive', 'NO_SUPPORTED_FILES');
  return stats;
}

export const removeDir = (dir) => fs.rmSync(dir, { recursive: true, force: true });
