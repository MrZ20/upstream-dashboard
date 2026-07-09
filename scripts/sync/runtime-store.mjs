import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathExists } from './utils.mjs';

export function parseIndex(value) {
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

export async function writeDomain(targetRoot, domain, projects) {
  const domainDir = path.join(targetRoot, domain);
  await fs.mkdir(domainDir, { recursive: true });
  await fs.writeFile(path.join(domainDir, '_index.md'), indexText(projects));
  for (const project of projects) {
    await fs.writeFile(path.join(domainDir, `${project.name}.json`), `${JSON.stringify(project, null, 2)}\n`);
  }
}

export async function readExistingDomainProjects(config, domain) {
  const domainDir = path.join(config.dataDir, domain);
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

export async function preserveAscendCiFromExisting(config, project) {
  const existingProjects = await readExistingDomainProjects(config, 'ascend');
  const existingProject = existingProjects.find(item => item.name === project.name);
  return mergeAscendProjectCi(project, existingProject);
}

export async function preserveAscendCiForProjects(config, projects) {
  const existingProjects = await readExistingDomainProjects(config, 'ascend');
  const existingByName = new Map(existingProjects.map(project => [project.name, project]));
  return projects.map(project => mergeAscendProjectCi(project, existingByName.get(project.name)));
}

export async function countDomainProjects(config, domain) {
  const indexPath = path.join(config.dataDir, domain, '_index.md');
  try {
    return parseIndex(await fs.readFile(indexPath, 'utf8')).length;
  } catch {
    return 0;
  }
}

export async function writeMetadata(config, metadata) {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(path.join(config.dataDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
}

export async function replaceDomainData(config, domain, nextRoot, projects, metadata) {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.rm(path.join(config.dataDir, `${domain}.previous`), { recursive: true, force: true });
  if (await pathExists(path.join(config.dataDir, domain))) {
    await fs.rename(path.join(config.dataDir, domain), path.join(config.dataDir, `${domain}.previous`));
  }
  await fs.rename(path.join(nextRoot, domain), path.join(config.dataDir, domain));
  await fs.rm(path.join(config.dataDir, `${domain}.previous`), { recursive: true, force: true });
  await writeMetadata(config, {
    ...metadata,
    projectCounts: {
      kunpeng: await countDomainProjects(config, 'kunpeng'),
      ascend: await countDomainProjects(config, 'ascend'),
    },
    checksum: createHash('sha256').update(JSON.stringify(projects)).digest('hex'),
  });
}

export async function replaceData(config, nextRoot, projects, startedAt) {
  await fs.mkdir(config.dataDir, { recursive: true });
  const metadata = {
    lastSyncedAt: new Date().toISOString(),
    startedAt,
    source: 'multi-remote',
    sources: {
      kunpeng: config.kunpengRepoUrl,
      ascend: config.ascendRepoUrl,
    },
    branches: {
      kunpeng: config.kunpengBranch,
      ascend: config.ascendBranch,
    },
    paths: {
      kunpeng: config.kunpengTestsPath,
      ascend: config.ascendProjectsPath,
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
    await fs.rm(path.join(config.dataDir, `${name}.previous`), { recursive: true, force: true });
    if (await pathExists(path.join(config.dataDir, name))) {
      await fs.rename(path.join(config.dataDir, name), path.join(config.dataDir, `${name}.previous`));
    }
    await fs.rename(path.join(nextRoot, name), path.join(config.dataDir, name));
    await fs.rm(path.join(config.dataDir, `${name}.previous`), { recursive: true, force: true });
  }

  return metadata;
}

export async function upsertAscendProject(config, project, startedAt, scope = 'project') {
  const domainDir = path.join(config.dataDir, 'ascend');
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
      ascend: config.ascendRepoUrl,
    },
    branches: {
      ascend: config.ascendBranch,
    },
    paths: {
      ascend: `${config.ascendProjectsPath}/${project.name}`,
    },
    projectCounts: {
      kunpeng: await countDomainProjects(config, 'kunpeng'),
      ascend: await countDomainProjects(config, 'ascend'),
    },
  };
  await writeMetadata(config, metadata);
  return metadata;
}
