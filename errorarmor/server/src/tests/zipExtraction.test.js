import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { extractZipSafely } from '../utils/safeFileHandling.js';

const limits = { maxFiles: 100, maxUnzippedBytes: 10_000_000 };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ea-zip-'));

test('extracts supported files and skips ignored folders', () => {
  const z = new AdmZip();
  z.addFile('proj/src/app.js', Buffer.from('console.log(1)'));
  z.addFile('proj/node_modules/x/index.js', Buffer.from('x'));
  z.addFile('proj/logo.png', Buffer.from('png'));
  const dest = tmp();
  const stats = extractZipSafely(z.toBuffer(), dest, limits);
  assert.equal(stats.extracted, 1);
  assert.equal(stats.skippedIgnored, 1);
  assert.equal(stats.skippedUnsupported, 1);
  assert.ok(fs.existsSync(path.join(dest, 'proj/src/app.js')));
});

test('rejects non-zip data and path traversal entries', () => {
  assert.throws(() => extractZipSafely(Buffer.from('hello world'), tmp(), limits), /not a valid ZIP/);
  const z = new AdmZip();
  z.addFile('ok.js', Buffer.from('1'));
  const buf = z.toBuffer();
  const evil = Buffer.from(buf.toString('binary').split('ok.js').join('../js'), 'binary'); // same length rename
  assert.throws(() => extractZipSafely(evil, tmp(), limits), /Unsafe path|corrupt|unreadable/i);
});

test('rejects archives with no supported files', () => {
  const z = new AdmZip();
  z.addFile('a.png', Buffer.from('x'));
  assert.throws(() => extractZipSafely(z.toBuffer(), tmp(), limits), /No supported source files/);
});
