import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeEntryPath, isSupportedFile } from '../utils/safeFileHandling.js';

test('rejects unsafe archive paths', () => {
  for (const bad of ['../evil.js', 'a/../../evil.js', '/etc/passwd', 'C:/x.js', 'a\\b.js', 'a\0b.js']) assert.equal(isSafeEntryPath(bad), false, bad);
  for (const good of ['src/app.js', 'a/b/c.json', '.env.example']) assert.equal(isSafeEntryPath(good), true, good);
});

test('supported file detection', () => {
  assert.ok(isSupportedFile('app.jsx'));
  assert.ok(isSupportedFile('.env'));
  assert.ok(!isSupportedFile('payload.exe'));
  assert.ok(!isSupportedFile('image.png'));
});
