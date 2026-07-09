import fs from 'node:fs/promises';
import { syncLockPath } from './config.mjs';

async function isStaleLock(config) {
  try {
    const text = await fs.readFile(syncLockPath(config), 'utf8');
    const startedAt = JSON.parse(text).startedAt;
    const ageMs = Date.now() - new Date(startedAt).getTime();
    return Number.isFinite(ageMs) && ageMs > config.syncLockStaleSeconds * 1000;
  } catch {
    return false;
  }
}

export async function acquireLock(config, startedAt) {
  await fs.mkdir(config.dataDir, { recursive: true });
  const lockFile = syncLockPath(config);
  try {
    const lock = await fs.open(lockFile, 'wx');
    await lock.writeFile(`${JSON.stringify({ pid: process.pid, startedAt })}\n`);
    return lock;
  } catch (error) {
    if (error?.code === 'EEXIST' && await isStaleLock(config)) {
      await fs.rm(lockFile, { force: true });
      const lock = await fs.open(lockFile, 'wx');
      await lock.writeFile(`${JSON.stringify({ pid: process.pid, startedAt, recoveredStaleLock: true })}\n`);
      return lock;
    }
    if (error?.code === 'EEXIST') {
      throw new Error('Data sync already running.');
    }
    throw error;
  }
}

export async function releaseLock(config, lock) {
  try {
    await lock.close();
  } catch {
    // Ignore close errors; removing the lock file below is enough for recovery.
  }
  await fs.rm(syncLockPath(config), { force: true });
}
