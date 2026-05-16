import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { copyDir } from '../lib/copy.js';

async function makeTmp(prefix) {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeTree(root, tree) {
  for (const [rel, content] of Object.entries(tree)) {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  }
}

test('copies all files into a new destination', async () => {
  const src = await makeTmp('wtf-src-');
  const dest = path.join(await makeTmp('wtf-dest-parent-'), 'dest');
  await writeTree(src, {
    'a.md': 'A',
    'sub/b.md': 'B',
    'sub/deep/c.md': 'C',
  });

  const result = await copyDir(src, dest, { force: false });

  assert.equal(result.existed, false);
  assert.equal(result.copied, 3);
  assert.equal(await fs.readFile(path.join(dest, 'a.md'), 'utf8'), 'A');
  assert.equal(await fs.readFile(path.join(dest, 'sub/b.md'), 'utf8'), 'B');
  assert.equal(await fs.readFile(path.join(dest, 'sub/deep/c.md'), 'utf8'), 'C');
});

test('returns existed=true and does not overwrite when force=false', async () => {
  const src = await makeTmp('wtf-src-');
  const dest = await makeTmp('wtf-dest-');
  await writeTree(src, { 'a.md': 'NEW' });
  await writeTree(dest, { 'a.md': 'OLD' });

  const result = await copyDir(src, dest, { force: false });

  assert.equal(result.existed, true);
  assert.equal(result.copied, 0);
  assert.equal(await fs.readFile(path.join(dest, 'a.md'), 'utf8'), 'OLD');
});

test('overwrites when force=true', async () => {
  const src = await makeTmp('wtf-src-');
  const dest = await makeTmp('wtf-dest-');
  await writeTree(src, { 'a.md': 'NEW' });
  await writeTree(dest, { 'a.md': 'OLD', 'stale.md': 'STALE' });

  const result = await copyDir(src, dest, { force: true });

  assert.equal(result.existed, true);
  assert.equal(result.copied, 1);
  assert.equal(await fs.readFile(path.join(dest, 'a.md'), 'utf8'), 'NEW');
  // force overwrite removes the old tree first, so stale.md should be gone
  await assert.rejects(() => fs.readFile(path.join(dest, 'stale.md'), 'utf8'));
});
