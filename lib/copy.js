import fs from 'node:fs/promises';
import path from 'node:path';

export async function copyDir(src, dest, { force = false } = {}) {
  let existed = false;
  try {
    await fs.access(dest);
    existed = true;
  } catch {
    existed = false;
  }

  if (existed && !force) {
    return { copied: 0, existed: true };
  }

  if (existed && force) {
    await fs.rm(dest, { recursive: true, force: true });
  }

  await fs.mkdir(dest, { recursive: true });
  const copied = await copyRecursive(src, dest);
  return { copied, existed };
}

async function copyRecursive(src, dest) {
  let count = 0;
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(d, { recursive: true });
      count += await copyRecursive(s, d);
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
      count += 1;
    }
  }
  return count;
}
