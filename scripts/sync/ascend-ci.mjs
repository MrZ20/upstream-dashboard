import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeStatus } from './normalize-project.mjs';
import { execFileAsync, pathExists } from './utils.mjs';

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

export function applyCiResult(project, stdout) {
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

export async function runAscendCiScript(config, project, repoDir, projectDir, projectJsonPath) {
  if (!config.ascendCiRunScripts) return project;

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
