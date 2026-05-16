import path from 'node:path';

const SKILL_DIR_NAME = 'weread-to-flomo';

export function resolveTarget({ scope, home, cwd, target }) {
  if (scope === 'global') {
    if (!home) throw new Error('home directory not available');
    return path.join(home, '.agents', 'skills', SKILL_DIR_NAME);
  }
  if (scope === 'project') {
    if (!cwd) throw new Error('cwd not available');
    return path.join(cwd, '.agents', 'skills', SKILL_DIR_NAME);
  }
  if (scope === 'custom') {
    if (!target) throw new Error('custom target path not provided');
    if (!path.isAbsolute(target)) throw new Error('custom target path must be absolute');
    return path.join(target, SKILL_DIR_NAME);
  }
  throw new Error(`unknown scope: ${scope}`);
}
