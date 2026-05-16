import path from 'node:path';

const SKILL_DIR_NAME = 'weread-to-flomo';

export function resolveTarget({ scope, home, cwd }) {
  if (scope === 'user') {
    if (!home) throw new Error('home directory not available');
    return path.join(home, '.claude', 'skills', SKILL_DIR_NAME);
  }
  if (scope === 'project') {
    if (!cwd) throw new Error('cwd not available');
    return path.join(cwd, '.claude', 'skills', SKILL_DIR_NAME);
  }
  throw new Error(`unknown scope: ${scope}`);
}
