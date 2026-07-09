import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function listJsonFiles(resultsDir, softwareName) {
  if (!await pathExists(resultsDir)) return [];
  const entries = await fs.readdir(resultsDir, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => path.join(resultsDir, entry.name))
    .sort();
  const preferred = path.join(resultsDir, `${softwareName}.json`);
  if (files.includes(preferred)) return [preferred, ...files.filter(file => file !== preferred)];
  return files;
}

export async function cloneSparse({ repoUrl, branch, sparsePath, repoDir, label }) {
  console.log(`Sparse clone ${repoUrl}#${branch}:${sparsePath}`);
  await execFileAsync('git', [
    'clone',
    '--depth', '1',
    '--filter=blob:none',
    '--sparse',
    '--branch', branch,
    repoUrl,
    repoDir,
  ], {
    maxBuffer: 20 * 1024 * 1024,
  });
  await execFileAsync('git', ['-C', repoDir, 'sparse-checkout', 'set', sparsePath], {
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log(`Checked out ${label || sparsePath}`);
}

export async function replaceDirectory(source, target) {
  if (!await pathExists(source)) {
    throw new Error(`Source directory not found: ${source}`);
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  const next = `${target}.next`;
  const previous = `${target}.previous`;
  await fs.rm(next, { recursive: true, force: true });
  await fs.rm(previous, { recursive: true, force: true });
  await fs.cp(source, next, { recursive: true });
  if (await pathExists(target)) await fs.rename(target, previous);
  await fs.rename(next, target);
  await fs.rm(previous, { recursive: true, force: true });
}

export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
