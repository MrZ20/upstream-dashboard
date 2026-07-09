#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DATA_DIR = process.env.DATA_DIR || '/project-data';
const KUNPENG_REPO_URL = process.env.KUNPENG_REPO_URL || process.env.REMOTE_REPO_URL || 'https://gitcode.com/openeuler/openeuler-docker-images.git';
const KUNPENG_BRANCH = process.env.KUNPENG_BRANCH || process.env.REMOTE_BRANCH || 'master';
const KUNPENG_TESTS_PATH = process.env.KUNPENG_TESTS_PATH || process.env.REMOTE_TESTS_PATH || 'tests';
const ASCEND_REPO_URL = process.env.ASCEND_REPO_URL || 'https://github.com/MrZ20/ascend-testdata.git';
const ASCEND_BRANCH = process.env.ASCEND_BRANCH || 'main';
const ASCEND_PROJECTS_PATH = process.env.ASCEND_PROJECTS_PATH || 'project';
const SOURCE_CACHE_DIR = process.env.PROJECT_SOURCE_DIR || path.join(DATA_DIR, '_source-cache');
const SYNC_INTERVAL_SECONDS = Number(process.env.SYNC_INTERVAL_SECONDS || 24 * 60 * 60);
const LOCK_FILE = path.join(DATA_DIR, '.sync.lock');
const SYNC_LOCK_STALE_SECONDS = Number(process.env.SYNC_LOCK_STALE_SECONDS || 2 * 60 * 60);
const ASCEND_CI_RUN_SCRIPTS = !['0', 'false', 'no', 'off'].includes(String(process.env.ASCEND_CI_RUN_SCRIPTS || '1').toLowerCase());

const args = process.argv.slice(2);
const argSet = new Set(args);
const loop = argSet.has('--loop');
const delayFirst = argSet.has('--delay-first');
const syncDomain = readArgValue('--domain');
const ascendScope = readArgValue('--ascend-scope') || 'project';
const ascendProjectName = readArgValue('--ascend-project');
const ascendProjectScope = readArgValue('--ascend-project-scope') || ascendScope;

function readArgValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function normalizeStatus(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim().toLowerCase();
  if (['pass', 'passed', 'success', 'true', '通过'].includes(text)) return 'pass';
  if (['fail', 'failed', 'failure', 'false', '不通过'].includes(text)) return 'fail';
  return value;
}

function normalizePerformance(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim().toLowerCase();
  if (['improvement', 'improved', 'up', '提升'].includes(text)) return 'improvement';
  if (['stable', 'same', 'flat', '持平'].includes(text)) return 'stable';
  if (['regression', 'regressed', 'down', '回退'].includes(text)) return 'regression';
  return value;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function coerceMultiValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('; ');
  if (value == null) return '';
  return String(value);
}

function normalizeMaintainer(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return { name: value, email: '' };
  if (typeof value !== 'object') return undefined;
  if (!value.name && !value.email) return undefined;
  return compactObject({ name: value.name || '', email: value.email || '' });
}

function asProjectCandidates(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.projects)) return raw.projects;
  if (raw?.name || raw?.supportedVersions || raw?.versions) return [raw];
  return [];
}

function inferDomain(project, versions, forcedDomain) {
  if (forcedDomain) return forcedDomain;
  const type = String(project.type || project.domain || '').toLowerCase();
  if (type.includes('ascend') || type.includes('昇腾')) return 'ascend';
  if (type.includes('kunpeng') || type.includes('鲲鹏')) return 'kunpeng';
  if (versions.some(version => version.ci != null || version.ciDate != null)) return 'ascend';
  return 'kunpeng';
}

function normalizeVersions(rawVersions) {
  if (!Array.isArray(rawVersions)) return [];
  return rawVersions
    .map(version => compactObject({
      version: version.version || version.supportedVersion || version.supportVersion || version.integratedVersion || '',
      openEuler: coerceMultiValue(version.openEuler || version.openEulerVersion),
      hardware: coerceMultiValue(version.hardware || version.hardwareModel || version.hardwareModels),
      functional: normalizeStatus(version.functional ?? version.functionalTest ?? version.functionalStatus),
      functionalDate: version.functionalDate ?? version.functionalTestDate,
      performance: normalizePerformance(version.performance ?? version.performanceTest ?? version.performanceStatus),
      performanceDate: version.performanceDate ?? version.performanceTestDate,
      ci: normalizeStatus(version.ci ?? version.ciResult ?? version.ciStatus),
      ciDate: version.ciDate ?? version.ciResultDate,
      integratedDate: version.integratedDate || version.integrationDate || version.date || '',
    }))
    .filter(version => version.version && version.hardware);
}

function normalizeProject(project, softwareName, forcedDomain) {
  const versions = normalizeVersions(project.supportedVersions || project.versions);
  if (!versions.length) return null;

  const domain = inferDomain(project, versions, forcedDomain);
  const base = compactObject({
    name: project.name || softwareName,
    category: project.category || '未分类',
    upstream: project.upstream || project.upstreamUrl,
    maintainer: normalizeMaintainer(project.maintainer),
  });

  if (!base.name) return null;

  if (domain === 'ascend') {
    return {
      domain,
      project: compactObject({
        ...base,
        branch: project.branch || project.watchBranch,
        supportedVersions: versions.map(version => compactObject({
          version: version.version,
          hardware: version.hardware,
          ci: version.ci ?? null,
          ciDate: version.ciDate ?? null,
          integratedDate: version.integratedDate || '',
        })),
      }),
    };
  }

  return {
    domain,
    project: compactObject({
      ...base,
      latestVersion: project.latestVersion || project.upstreamVersion,
      supportedVersions: versions.map(version => compactObject({
        version: version.version,
        openEuler: version.openEuler || '',
        hardware: version.hardware,
        functional: version.functional ?? null,
        functionalDate: version.functionalDate ?? null,
        performance: version.performance ?? null,
        performanceDate: version.performanceDate ?? null,
        integratedDate: version.integratedDate || '',
      })),
    }),
  };
}

async function isStaleLock() {
  try {
    const text = await fs.readFile(LOCK_FILE, 'utf8');
    const startedAt = JSON.parse(text).startedAt;
    const ageMs = Date.now() - new Date(startedAt).getTime();
    return Number.isFinite(ageMs) && ageMs > SYNC_LOCK_STALE_SECONDS * 1000;
  } catch {
    return false;
  }
}

async function acquireLock(startedAt) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const lock = await fs.open(LOCK_FILE, 'wx');
    await lock.writeFile(`${JSON.stringify({ pid: process.pid, startedAt })}\n`);
    return lock;
  } catch (error) {
    if (error?.code === 'EEXIST' && await isStaleLock()) {
      await fs.rm(LOCK_FILE, { force: true });
      const lock = await fs.open(LOCK_FILE, 'wx');
      await lock.writeFile(`${JSON.stringify({ pid: process.pid, startedAt, recoveredStaleLock: true })}\n`);
      return lock;
    }
    if (error?.code === 'EEXIST') {
      throw new Error('Data sync already running.');
    }
    throw error;
  }
}

async function releaseLock(lock) {
  try {
    await lock.close();
  } catch {
    // Ignore close errors; the lock file cleanup below is the important part.
  }
  await fs.rm(LOCK_FILE, { force: true });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function listJsonFiles(resultsDir, softwareName) {
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

async function cloneSparse({ repoUrl, branch, sparsePath, repoDir, label }) {
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


function cachedAscendRepoRoot() {
  return path.join(SOURCE_CACHE_DIR, 'ascend');
}

function cachedAscendProjectsDir() {
  return path.join(cachedAscendRepoRoot(), ASCEND_PROJECTS_PATH);
}

async function replaceDirectory(source, target) {
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

async function cacheAscendProjectsFromRepo(repoDir, projectName) {
  const source = projectName
    ? path.join(repoDir, ASCEND_PROJECTS_PATH, projectName)
    : path.join(repoDir, ASCEND_PROJECTS_PATH);
  const target = projectName
    ? path.join(cachedAscendProjectsDir(), projectName)
    : cachedAscendProjectsDir();
  await replaceDirectory(source, target);
}

async function assertAscendProjectCache(projectName) {
  const target = projectName
    ? path.join(cachedAscendProjectsDir(), projectName)
    : cachedAscendProjectsDir();
  if (!await pathExists(target)) {
    throw new Error(projectName
      ? `Ascend project cache not found for ${projectName}. Refresh project first.`
      : 'Ascend project cache not found. Refresh projects first.');
  }
}

async function readKunpengProjects(repoDir) {
  const testsDir = path.join(repoDir, KUNPENG_TESTS_PATH);
  const projects = [];
  const seen = new Set();

  if (!await pathExists(testsDir)) {
    throw new Error(`Kunpeng tests path not found: ${KUNPENG_TESTS_PATH}`);
  }

  const softwareDirs = [];
  if (await pathExists(path.join(testsDir, 'results'))) {
    softwareDirs.push({ name: path.basename(testsDir), dir: testsDir });
  } else {
    const testEntries = await fs.readdir(testsDir, { withFileTypes: true });
    softwareDirs.push(...testEntries
      .filter(item => item.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(entry => ({ name: entry.name, dir: path.join(testsDir, entry.name) })));
  }

  for (const softwareDir of softwareDirs) {
    const files = await listJsonFiles(path.join(softwareDir.dir, 'results'), softwareDir.name);
    for (const file of files) {
      try {
        const raw = JSON.parse(await fs.readFile(file, 'utf8'));
        for (const candidate of asProjectCandidates(raw)) {
          const normalized = normalizeProject(candidate, softwareDir.name, 'kunpeng');
          if (!normalized) continue;
          if (seen.has(normalized.project.name)) continue;
          seen.add(normalized.project.name);
          projects.push(normalized.project);
        }
      } catch (error) {
        console.warn(`Skip invalid Kunpeng result file: ${file}`, error.message);
      }
    }
  }

  return projects;
}

function resolveScriptPath(repoDir, projectDir, scriptRef) {
  if (!scriptRef) return null;
  const candidates = [
    path.resolve(projectDir, scriptRef),
    path.resolve(repoDir, scriptRef),
    path.resolve(projectDir, path.basename(scriptRef)),
  ];
  const repoRoot = path.resolve(repoDir);
  return candidates.find(candidate => candidate === repoRoot || candidate.startsWith(`${repoRoot}${path.sep}`)) || null;
}

function applyCiResult(project, stdout) {
  const text = stdout.trim();
  if (!text) return project;

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    return project;
  }

  const ci = normalizeStatus(result.ci ?? result.ci_result ?? result.result);
  const ciDate = result.ciDate ?? result.ci_date ?? result.test_date;
  if (!ci && !ciDate) return project;

  const targetVersion = result.version || project.branch || project.supportedVersions?.[0]?.version;
  let matched = false;
  const supportedVersions = (project.supportedVersions || []).map((version, index) => {
    const isTarget = version.version === targetVersion || (!matched && index === 0 && !targetVersion);
    if (!isTarget) return version;
    matched = true;
    return {
      ...version,
      ci: ci ?? version.ci ?? null,
      ciDate: ciDate ?? version.ciDate ?? null,
    };
  });

  if (!matched && supportedVersions[0]) {
    supportedVersions[0] = {
      ...supportedVersions[0],
      ci: ci ?? supportedVersions[0].ci ?? null,
      ciDate: ciDate ?? supportedVersions[0].ciDate ?? null,
    };
  }

  return { ...project, supportedVersions };
}

async function runAscendCiScript(project, repoDir, projectDir, projectJsonPath) {
  if (!ASCEND_CI_RUN_SCRIPTS) return project;

  const scriptRef = project.script || project.ciScript;
  const scriptPath = resolveScriptPath(repoDir, projectDir, scriptRef);
  if (!scriptPath || !await pathExists(scriptPath)) return project;

  try {
    const command = scriptPath.endsWith('.sh') ? 'bash' : scriptPath;
    const commandArgs = scriptPath.endsWith('.sh') ? [scriptPath] : [];
    const result = await execFileAsync(command, commandArgs, {
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        RESULT_FILE: projectJsonPath,
      },
      maxBuffer: 20 * 1024 * 1024,
    });

    let updated = JSON.parse(await fs.readFile(projectJsonPath, 'utf8'));
    updated = applyCiResult(updated, result.stdout || '');
    await fs.writeFile(projectJsonPath, `${JSON.stringify(updated, null, 2)}\n`);
    return updated;
  } catch (error) {
    console.warn(`CI script failed for ${project.name || path.basename(projectDir)}: ${error.message}`);
    return project;
  }
}

async function readAscendProject(projectDir, repoDir, runCiScripts = true) {
  const projectName = path.basename(projectDir);
  const files = await listJsonFiles(projectDir, projectName);
  if (!files.length) return null;

  const jsonPath = files[0];
  let raw = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  if (runCiScripts) raw = await runAscendCiScript(raw, repoDir, projectDir, jsonPath);
  return normalizeProject(raw, projectName, 'ascend')?.project || null;
}

async function readAscendProjects(repoDir, projectName, options = {}) {
  const projectsDir = path.join(repoDir, ASCEND_PROJECTS_PATH);
  if (!await pathExists(projectsDir)) {
    throw new Error(`Ascend projects path not found: ${ASCEND_PROJECTS_PATH}`);
  }

  const projectDirs = [];
  if (projectName) {
    projectDirs.push(path.join(projectsDir, projectName));
  } else {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    projectDirs.push(...entries
      .filter(entry => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(entry => path.join(projectsDir, entry.name)));
  }

  const projects = [];
  const seen = new Set();
  for (const projectDir of projectDirs) {
    if (!await pathExists(projectDir)) continue;
    try {
      const project = await readAscendProject(projectDir, repoDir, options.runCiScripts ?? true);
      if (!project || seen.has(project.name)) continue;
      seen.add(project.name);
      projects.push(project);
    } catch (error) {
      console.warn(`Skip invalid Ascend project folder: ${projectDir}`, error.message);
    }
  }

  return projects;
}

function parseIndex(value) {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim())
    .filter(Boolean);
}

function indexText(projects) {
  return `# Project order\n\n${projects.map(project => `- ${project.name}.json`).join('\n')}\n`;
}

function indexTextFromFiles(fileNames) {
  return `# Project order\n\n${fileNames.map(fileName => `- ${fileName}`).join('\n')}\n`;
}

async function writeDomain(targetRoot, domain, projects) {
  const domainDir = path.join(targetRoot, domain);
  await fs.mkdir(domainDir, { recursive: true });
  await fs.writeFile(path.join(domainDir, '_index.md'), indexText(projects));
  for (const project of projects) {
    await fs.writeFile(path.join(domainDir, `${project.name}.json`), `${JSON.stringify(project, null, 2)}\n`);
  }
}


async function readExistingDomainProjects(domain) {
  const domainDir = path.join(DATA_DIR, domain);
  const indexPath = path.join(domainDir, '_index.md');
  let fileNames = [];
  try {
    fileNames = parseIndex(await fs.readFile(indexPath, 'utf8'));
  } catch {
    return [];
  }

  const projects = [];
  for (const fileName of fileNames) {
    try {
      const project = JSON.parse(await fs.readFile(path.join(domainDir, fileName), 'utf8'));
      if (project?.name) projects.push(project);
    } catch {
      // Ignore stale or partially deleted runtime files.
    }
  }
  return projects;
}

function mergeAscendProjectCi(project, existingProject) {
  if (!existingProject) return project;
  const existingVersions = existingProject.supportedVersions || [];
  return {
    ...project,
    supportedVersions: (project.supportedVersions || []).map((version, index) => {
      const old = existingVersions.find(item => item.version === version.version && item.hardware === version.hardware)
        || existingVersions.find(item => item.version === version.version)
        || existingVersions[index];
      return {
        ...version,
        ci: old?.ci ?? version.ci ?? null,
        ciDate: old?.ciDate ?? version.ciDate ?? null,
      };
    }),
  };
}

async function preserveAscendCiFromExisting(project) {
  const existingProjects = await readExistingDomainProjects('ascend');
  const existingProject = existingProjects.find(item => item.name === project.name);
  return mergeAscendProjectCi(project, existingProject);
}

async function preserveAscendCiForProjects(projects) {
  const existingProjects = await readExistingDomainProjects('ascend');
  const existingByName = new Map(existingProjects.map(project => [project.name, project]));
  return projects.map(project => mergeAscendProjectCi(project, existingByName.get(project.name)));
}

async function replaceDomainData(domain, nextRoot, projects, metadata) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.rm(path.join(DATA_DIR, `${domain}.previous`), { recursive: true, force: true });
  if (await pathExists(path.join(DATA_DIR, domain))) {
    await fs.rename(path.join(DATA_DIR, domain), path.join(DATA_DIR, `${domain}.previous`));
  }
  await fs.rename(path.join(nextRoot, domain), path.join(DATA_DIR, domain));
  await fs.rm(path.join(DATA_DIR, `${domain}.previous`), { recursive: true, force: true });
  await writeMetadata({
    ...metadata,
    projectCounts: {
      kunpeng: await countDomainProjects('kunpeng'),
      ascend: await countDomainProjects('ascend'),
    },
    checksum: createHash('sha256').update(JSON.stringify(projects)).digest('hex'),
  });
}

async function countDomainProjects(domain) {
  const indexPath = path.join(DATA_DIR, domain, '_index.md');
  try {
    return parseIndex(await fs.readFile(indexPath, 'utf8')).length;
  } catch {
    return 0;
  }
}

async function writeMetadata(metadata) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
}

async function replaceData(nextRoot, projects, startedAt) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const metadata = {
    lastSyncedAt: new Date().toISOString(),
    startedAt,
    source: 'multi-remote',
    sources: {
      kunpeng: KUNPENG_REPO_URL,
      ascend: ASCEND_REPO_URL,
    },
    branches: {
      kunpeng: KUNPENG_BRANCH,
      ascend: ASCEND_BRANCH,
    },
    paths: {
      kunpeng: KUNPENG_TESTS_PATH,
      ascend: ASCEND_PROJECTS_PATH,
    },
    projectCounts: {
      kunpeng: projects.kunpeng.length,
      ascend: projects.ascend.length,
    },
    checksum: createHash('sha256')
      .update(JSON.stringify(projects))
      .digest('hex'),
  };

  await fs.writeFile(path.join(nextRoot, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

  for (const name of ['kunpeng', 'ascend', 'metadata.json']) {
    await fs.rm(path.join(DATA_DIR, `${name}.previous`), { recursive: true, force: true });
    if (await pathExists(path.join(DATA_DIR, name))) {
      await fs.rename(path.join(DATA_DIR, name), path.join(DATA_DIR, `${name}.previous`));
    }
    await fs.rename(path.join(nextRoot, name), path.join(DATA_DIR, name));
    await fs.rm(path.join(DATA_DIR, `${name}.previous`), { recursive: true, force: true });
  }

  return metadata;
}

async function upsertAscendProject(project, startedAt, scope = 'project') {
  const domainDir = path.join(DATA_DIR, 'ascend');
  await fs.mkdir(domainDir, { recursive: true });

  const fileName = `${project.name}.json`;
  const indexPath = path.join(domainDir, '_index.md');
  let fileNames = [];
  try {
    fileNames = parseIndex(await fs.readFile(indexPath, 'utf8'));
  } catch {
    fileNames = [];
  }
  if (!fileNames.includes(fileName)) fileNames.push(fileName);

  await fs.writeFile(path.join(domainDir, fileName), `${JSON.stringify(project, null, 2)}\n`);
  await fs.writeFile(indexPath, indexTextFromFiles(fileNames));

  const metadata = {
    lastSyncedAt: new Date().toISOString(),
    startedAt,
    source: scope === 'ci' ? 'ascend-project-ci' : scope === 'all' ? 'ascend-project-all' : 'ascend-project',
    sources: {
      ascend: ASCEND_REPO_URL,
    },
    branches: {
      ascend: ASCEND_BRANCH,
    },
    paths: {
      ascend: `${ASCEND_PROJECTS_PATH}/${project.name}`,
    },
    projectCounts: {
      kunpeng: await countDomainProjects('kunpeng'),
      ascend: await countDomainProjects('ascend'),
    },
  };
  await writeMetadata(metadata);
  return metadata;
}

async function syncKunpengData(startedAt, workDir) {
  const repoDir = path.join(workDir, 'kunpeng-repo');
  const nextRoot = path.join(workDir, 'next-kunpeng-data');

  await cloneSparse({
    repoUrl: KUNPENG_REPO_URL,
    branch: KUNPENG_BRANCH,
    sparsePath: KUNPENG_TESTS_PATH,
    repoDir,
    label: 'Kunpeng data',
  });

  const projects = await readKunpengProjects(repoDir);
  if (!projects.length) throw new Error('No valid Kunpeng project JSON found. Keep existing data.');

  await writeDomain(nextRoot, 'kunpeng', projects);
  const metadata = {
    lastSyncedAt: new Date().toISOString(),
    startedAt,
    source: 'kunpeng',
    sources: { kunpeng: KUNPENG_REPO_URL },
    branches: { kunpeng: KUNPENG_BRANCH },
    paths: { kunpeng: KUNPENG_TESTS_PATH },
  };
  await replaceDomainData('kunpeng', nextRoot, projects, metadata);
  console.log(`Synced ${projects.length} Kunpeng projects at ${metadata.lastSyncedAt}`);
  return metadata;
}

async function syncAscendData(startedAt, workDir, scope = 'project') {
  const nextRoot = path.join(workDir, 'next-ascend-data');
  let repoDir = path.join(workDir, 'ascend-repo');

  if (scope === 'ci') {
    await assertAscendProjectCache();
    repoDir = cachedAscendRepoRoot();
  } else {
    await cloneSparse({
      repoUrl: ASCEND_REPO_URL,
      branch: ASCEND_BRANCH,
      sparsePath: ASCEND_PROJECTS_PATH,
      repoDir,
      label: 'Ascend project data',
    });
  }

  let projects = await readAscendProjects(repoDir, undefined, {
    runCiScripts: scope === 'all' || scope === 'ci',
  });
  if (scope === 'project') projects = await preserveAscendCiForProjects(projects);
  if (!projects.length) throw new Error('No valid Ascend project JSON found. Keep existing data.');
  if (scope !== 'ci') await cacheAscendProjectsFromRepo(repoDir);

  await writeDomain(nextRoot, 'ascend', projects);
  const metadata = {
    lastSyncedAt: new Date().toISOString(),
    startedAt,
    source: scope === 'ci' ? 'ascend-ci' : scope === 'all' ? 'ascend-all' : 'ascend-projects',
    sources: { ascend: ASCEND_REPO_URL },
    branches: { ascend: ASCEND_BRANCH },
    paths: { ascend: ASCEND_PROJECTS_PATH },
  };
  await replaceDomainData('ascend', nextRoot, projects, metadata);
  console.log(`Synced ${projects.length} Ascend projects at ${metadata.lastSyncedAt}`);
  return metadata;
}

async function syncFullData(startedAt, workDir) {
  const kunpengRepoDir = path.join(workDir, 'kunpeng-repo');
  const ascendRepoDir = path.join(workDir, 'ascend-repo');
  const nextRoot = path.join(workDir, 'next-data');

  await cloneSparse({
    repoUrl: KUNPENG_REPO_URL,
    branch: KUNPENG_BRANCH,
    sparsePath: KUNPENG_TESTS_PATH,
    repoDir: kunpengRepoDir,
    label: 'Kunpeng data',
  });
  await cloneSparse({
    repoUrl: ASCEND_REPO_URL,
    branch: ASCEND_BRANCH,
    sparsePath: ASCEND_PROJECTS_PATH,
    repoDir: ascendRepoDir,
    label: 'Ascend project data',
  });

  const projects = {
    kunpeng: await readKunpengProjects(kunpengRepoDir),
    ascend: await readAscendProjects(ascendRepoDir, undefined, { runCiScripts: true }),
  };
  const total = projects.kunpeng.length + projects.ascend.length;
  if (!total) throw new Error('No valid project JSON found in remote data. Keep existing data.');
  if (projects.ascend.length) await cacheAscendProjectsFromRepo(ascendRepoDir);

  await writeDomain(nextRoot, 'kunpeng', projects.kunpeng);
  await writeDomain(nextRoot, 'ascend', projects.ascend);
  const metadata = await replaceData(nextRoot, projects, startedAt);
  console.log(`Synced ${total} projects at ${metadata.lastSyncedAt}`);
  return metadata;
}

async function syncAscendProjectData(projectName, startedAt, workDir, scope = 'project') {
  if (!projectName) throw new Error('--ascend-project requires a project name.');

  let repoDir = path.join(workDir, 'ascend-repo');
  if (scope === 'ci') {
    await assertAscendProjectCache(projectName);
    repoDir = cachedAscendRepoRoot();
  } else {
    await cloneSparse({
      repoUrl: ASCEND_REPO_URL,
      branch: ASCEND_BRANCH,
      sparsePath: `${ASCEND_PROJECTS_PATH}/${projectName}`,
      repoDir,
      label: `Ascend project ${projectName}`,
    });
  }

  const projects = await readAscendProjects(repoDir, projectName, {
    runCiScripts: scope === 'all' || scope === 'ci',
  });
  if (!projects.length) throw new Error(`No valid Ascend project JSON found for ${projectName}.`);
  if (scope !== 'ci') await cacheAscendProjectsFromRepo(repoDir, projectName);

  const project = scope === 'project' ? await preserveAscendCiFromExisting(projects[0]) : projects[0];
  const metadata = await upsertAscendProject(project, startedAt, scope);
  console.log(`Synced Ascend project ${project.name} at ${metadata.lastSyncedAt}`);
  return metadata;
}

export async function syncDataOnce() {
  const startedAt = new Date().toISOString();
  const lock = await acquireLock(startedAt);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upstream-dashboard-sync-'));

  try {
    if (ascendProjectName) {
      return await syncAscendProjectData(ascendProjectName, startedAt, workDir, ascendProjectScope);
    }
    if (syncDomain === 'kunpeng') return await syncKunpengData(startedAt, workDir);
    if (syncDomain === 'ascend') return await syncAscendData(startedAt, workDir, ascendScope);
    return await syncFullData(startedAt, workDir);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
    await releaseLock(lock);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLoop() {
  const intervalMs = Math.max(60, SYNC_INTERVAL_SECONDS) * 1000;
  if (delayFirst) await sleep(intervalMs);

  while (true) {
    try {
      await syncDataOnce();
    } catch (error) {
      console.error(error);
    }
    await sleep(intervalMs);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (loop) {
    await runLoop();
  } else {
    await syncDataOnce();
  }
}
