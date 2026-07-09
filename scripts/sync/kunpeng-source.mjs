import fs from 'node:fs/promises';
import path from 'node:path';
import { asProjectCandidates, normalizeProject } from './normalize-project.mjs';
import { listJsonFiles, pathExists } from './utils.mjs';

export async function readKunpengProjects(config, repoDir) {
  const testsDir = path.join(repoDir, config.kunpengTestsPath);
  const projects = [];
  const seen = new Set();

  if (!await pathExists(testsDir)) {
    throw new Error(`Kunpeng tests path not found: ${config.kunpengTestsPath}`);
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
