import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveTarget } from '../lib/resolve-target.js';

test('global scope → ~/.agents/skills/weread-to-flomo', () => {
  const got = resolveTarget({ scope: 'global', home: '/home/alice', cwd: '/anywhere' });
  assert.equal(got, path.join('/home/alice', '.agents', 'skills', 'weread-to-flomo'));
});

test('project scope → cwd/.agents/skills/weread-to-flomo', () => {
  const got = resolveTarget({ scope: 'project', home: '/home/alice', cwd: '/work/proj' });
  assert.equal(got, path.join('/work/proj', '.agents', 'skills', 'weread-to-flomo'));
});

test('custom scope with absolute target → target/weread-to-flomo', () => {
  const got = resolveTarget({ scope: 'custom', home: '/h', cwd: '/c', target: '/opt/skills' });
  assert.equal(got, path.join('/opt/skills', 'weread-to-flomo'));
});

test('unknown scope throws', () => {
  assert.throws(
    () => resolveTarget({ scope: 'user', home: '/h', cwd: '/c' }),
    /unknown scope: user/
  );
});

test('missing home for global scope throws', () => {
  assert.throws(
    () => resolveTarget({ scope: 'global', home: '', cwd: '/c' }),
    /home directory not available/
  );
});

test('missing cwd for project scope throws', () => {
  assert.throws(
    () => resolveTarget({ scope: 'project', home: '/h', cwd: '' }),
    /cwd not available/
  );
});

test('missing target for custom scope throws', () => {
  assert.throws(
    () => resolveTarget({ scope: 'custom', home: '/h', cwd: '/c', target: '' }),
    /custom target path not provided/
  );
});

test('relative target for custom scope throws', () => {
  assert.throws(
    () => resolveTarget({ scope: 'custom', home: '/h', cwd: '/c', target: 'relative/path' }),
    /custom target path must be absolute/
  );
});
