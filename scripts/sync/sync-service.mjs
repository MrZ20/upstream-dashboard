import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cachedAscendRepoRoot, readSyncArgs, readSyncConfig } from './config.mjs';
import { acquireLock, releaseLock } from './lock.mjs';
import { cacheAscendProjectsFromRepo, assertAscendProjectCache, readAscendProjects } from './ascend-source.mjs';
import { readKunpengProjects } from './kunpeng-source.mjs';
import {
  preserveAscendCiForProjects,
  preserveAscendCiFromExisting,
  replaceData,
  replaceDomainData,
  upsertAscendProject,
  writeDomain,
} from './runtime-store.mjs';
import { cloneSparse, sleep } from './utils.mjs';

async function syncKunpengData(config, startedAt, workDir) {
  const repoDir = path.join(workDir, 'kunpeng-repo');
  const nextRoot = path.join(workDir, 'next-kunpeng-data');

  await cloneSparse({
    repoUrl: config.kunpengRepoUrl,
    branch: config.kunpengBranch,
    sparsePath: config.kunpengTestsPath,
    repoDir,
    label: 'Kunpeng data',
  });

  const projects = await readKunpengProjects(config, repoDir);
  if (!projects.length) throw new Error('No valid Kunpeng project JSON found. Keep existing data.');

  await writeDomain(nextRoot, 'kunpeng', projects);
  const metadata = {
    lastSyncedAt: new Date().toISOString(),
    startedAt,
    source: 'kunpeng',
    sources: { kunpeng: config.kunpengRepoUrl },
    branches: { kunpeng: config.kunpengBranch },
    paths: { kunpeng: config.kunpengTestsPath },
  };
  await replaceDomainData(config, 'kunpeng', nextRoot, projects, metadata);
  console.log(`Synced ${projects.length} Kunpeng projects at ${metadata.lastSyncedAt}`);
  return metadata;
}

async function syncAscendData(config, startedAt, workDir, scope = 'project') {
  const nextRoot = path.join(workDir, 'next-ascend-data');
  let repoDir = path.join(workDir, 'ascend-repo');

  if (scope === 'ci') {
    await assertAscendProjectCache(config);
    repoDir = cachedAscendRepoRoot(config);
  } else {
    await cloneSparse({
      repoUrl: config.ascendRepoUrl,
      branch: config.ascendBranch,
      sparsePath: config.ascendProjectsPath,
      repoDir,
      label: 'Ascend project data',
    });
  }

  let projects = await readAscendProjects(config, repoDir, undefined, {
    runCiScripts: scope === 'all' || scope === 'ci',
  });
  if (scope === 'project') projects = await preserveAscendCiForProjects(config, projects);
  if (!projects.length) throw new Error('No valid Ascend project JSON found. Keep existing data.');
  if (scope !== 'ci') await cacheAscendProjectsFromRepo(config, repoDir);

  await writeDomain(nextRoot, 'ascend', projects);
  const metadata = {
    lastSyncedAt: new Date().toISOString(),
    startedAt,
    source: scope === 'ci' ? 'ascend-ci' : scope === 'all' ? 'ascend-all' : 'ascend-projects',
    sources: { ascend: config.ascendRepoUrl },
    branches: { ascend: config.ascendBranch },
    paths: { ascend: config.ascendProjectsPath },
  };
  await replaceDomainData(config, 'ascend', nextRoot, projects, metadata);
  console.log(`Synced ${projects.length} Ascend projects at ${metadata.lastSyncedAt}`);
  return metadata;
}

async function syncFullData(config, startedAt, workDir) {
  const kunpengRepoDir = path.join(workDir, 'kunpeng-repo');
  const ascendRepoDir = path.join(workDir, 'ascend-repo');
  const nextRoot = path.join(workDir, 'next-data');

  await cloneSparse({
    repoUrl: config.kunpengRepoUrl,
    branch: config.kunpengBranch,
    sparsePath: config.kunpengTestsPath,
    repoDir: kunpengRepoDir,
    label: 'Kunpeng data',
  });
  await cloneSparse({
    repoUrl: config.ascendRepoUrl,
    branch: config.ascendBranch,
    sparsePath: config.ascendProjectsPath,
    repoDir: ascendRepoDir,
    label: 'Ascend project data',
  });

  const projects = {
    kunpeng: await readKunpengProjects(config, kunpengRepoDir),
    ascend: await readAscendProjects(config, ascendRepoDir, undefined, { runCiScripts: true }),
  };
  const total = projects.kunpeng.length + projects.ascend.length;
  if (!total) throw new Error('No valid project JSON found in remote data. Keep existing data.');
  if (projects.ascend.length) await cacheAscendProjectsFromRepo(config, ascendRepoDir);

  await writeDomain(nextRoot, 'kunpeng', projects.kunpeng);
  await writeDomain(nextRoot, 'ascend', projects.ascend);
  const metadata = await replaceData(config, nextRoot, projects, startedAt);
  console.log(`Synced ${total} projects at ${metadata.lastSyncedAt}`);
  return metadata;
}

async function syncAscendProjectData(config, projectName, startedAt, workDir, scope = 'project') {
  if (!projectName) throw new Error('--ascend-project requires a project name.');

  let repoDir = path.join(workDir, 'ascend-repo');
  if (scope === 'ci') {
    await assertAscendProjectCache(config, projectName);
    repoDir = cachedAscendRepoRoot(config);
  } else {
    await cloneSparse({
      repoUrl: config.ascendRepoUrl,
      branch: config.ascendBranch,
      sparsePath: `${config.ascendProjectsPath}/${projectName}`,
      repoDir,
      label: `Ascend project ${projectName}`,
    });
  }

  const projects = await readAscendProjects(config, repoDir, projectName, {
    runCiScripts: scope === 'all' || scope === 'ci',
  });
  if (!projects.length) throw new Error(`No valid Ascend project JSON found for ${projectName}.`);
  if (scope !== 'ci') await cacheAscendProjectsFromRepo(config, repoDir, projectName);

  const project = scope === 'project' ? await preserveAscendCiFromExisting(config, projects[0]) : projects[0];
  const metadata = await upsertAscendProject(config, project, startedAt, scope);
  console.log(`Synced Ascend project ${project.name} at ${metadata.lastSyncedAt}`);
  return metadata;
}

export async function syncDataOnce({ config = readSyncConfig(), args = readSyncArgs() } = {}) {
  const startedAt = new Date().toISOString();
  const lock = await acquireLock(config, startedAt);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upstream-dashboard-sync-'));

  try {
    if (args.ascendProjectName) {
      return await syncAscendProjectData(config, args.ascendProjectName, startedAt, workDir, args.ascendProjectScope);
    }
    if (args.syncDomain === 'kunpeng') return await syncKunpengData(config, startedAt, workDir);
    if (args.syncDomain === 'ascend') return await syncAscendData(config, startedAt, workDir, args.ascendScope);
    return await syncFullData(config, startedAt, workDir);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
    await releaseLock(config, lock);
  }
}

async function runLoop(config, args) {
  const intervalMs = Math.max(60, config.syncIntervalSeconds) * 1000;
  if (args.delayFirst) await sleep(intervalMs);

  while (true) {
    try {
      await syncDataOnce({ config, args });
    } catch (error) {
      console.error(error);
    }
    await sleep(intervalMs);
  }
}

export async function runSyncCli(rawArgs = process.argv.slice(2)) {
  const config = readSyncConfig();
  const args = readSyncArgs(rawArgs);
  if (args.loop) {
    await runLoop(config, args);
  } else {
    await syncDataOnce({ config, args });
  }
}
