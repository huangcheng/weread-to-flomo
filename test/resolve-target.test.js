import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveTarget } from '../lib/resolve-target.js';

test('user scope → ~/.claude/skills/weread-to-flomo', () => {
  const got = resolveTarget({ scope: 'user', home: '/home/alice', cwd: '/anywhere' });
  assert.equal(got, path.join('/home/alice', '.claude', 'skills', 'weread-to-flomo'));
});

test('project scope → cwd/.claude/skills/weread-to-flomo', () => {
  const got = resolveTarget({ scope: 'project', home: '/home/alice', cwd: '/work/proj' });
  assert.equal(got, path.join('/work/proj', '.claude', 'skills', 'weread-to-flomo'));
});

test('unknown scope throws', () => {
  assert.throws(
    () => resolveTarget({ scope: 'global', home: '/h', cwd: '/c' }),
    /unknown scope: global/
  );
});

test('missing home for user scope throws', () => {
  assert.throws(
    () => resolveTarget({ scope: 'user', home: '', cwd: '/c' }),
    /home directory not available/
  );
});

test('missing cwd for project scope throws', () => {
  assert.throws(
    () => resolveTarget({ scope: 'project', home: '/h', cwd: '' }),
    /cwd not available/
  );
});
