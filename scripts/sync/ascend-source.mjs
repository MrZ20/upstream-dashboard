import fs from 'node:fs/promises';
import path from 'node:path';
import { cachedAscendProjectsDir, cachedAscendRepoRoot } from './config.mjs';
import { normalizeProject } from './normalize-project.mjs';
import { runAscendCiScript } from './ascend-ci.mjs';
import { listJsonFiles, pathExists, replaceDirectory } from './utils.mjs';

export async function cacheAscendProjectsFromRepo(config, repoDir, projectName) {
  const source = projectName
    ? path.join(repoDir, config.ascendProjectsPath, projectName)
    : path.join(repoDir, config.ascendProjectsPath);
  const target = projectName
    ? path.join(cachedAscendProjectsDir(config), projectName)
    : cachedAscendProjectsDir(config);
  await replaceDirectory(source, target);
}

export async function assertAscendProjectCache(config, projectName) {
  const target = projectName
    ? path.join(cachedAscendProjectsDir(config), projectName)
    : cachedAscendProjectsDir(config);
  if (!await pathExists(target)) {
    throw new Error(projectName
      ? `Ascend project cache not found for ${projectName}. Refresh project first.`
      : 'Ascend project cache not found. Refresh projects first.');
  }
}

async function readAscendProject(config, projectDir, repoDir, runCiScripts = true) {
  const projectName = path.basename(projectDir);
  const files = await listJsonFiles(projectDir, projectName);
  if (!files.length) return null;

  const jsonPath = files[0];
  let raw = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  if (runCiScripts) raw = await runAscendCiScript(config, raw, repoDir, projectDir, jsonPath);
  return normalizeProject(raw, projectName, 'ascend')?.project || null;
}

export async function readAscendProjects(config, repoDir, projectName, options = {}) {
  const projectsDir = path.join(repoDir, config.ascendProjectsPath);
  if (!await pathExists(projectsDir)) {
    throw new Error(`Ascend projects path not found: ${config.ascendProjectsPath}`);
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
      const project = await readAscendProject(config, projectDir, repoDir, options.runCiScripts ?? true);
      if (!project || seen.has(project.name)) continue;
      seen.add(project.name);
      projects.push(project);
    } catch (error) {
      console.warn(`Skip invalid Ascend project folder: ${projectDir}`, error.message);
    }
  }

  return projects;
}

export { cachedAscendRepoRoot };
