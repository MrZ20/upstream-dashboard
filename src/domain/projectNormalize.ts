import { Project, ProjectType, VersionInfo } from './projectTypes';
import { joinUniqueValues, latestDate } from './projectFormat';

export function mergeAscendVersions(supportedVersions: VersionInfo[]): VersionInfo[] {
  if (!supportedVersions.length) return [];

  const base = supportedVersions[0];
  const targetCi: VersionInfo['ci'] = supportedVersions.some(version => version.ci === 'fail')
    ? 'fail'
    : supportedVersions.some(version => version.ci === 'pass')
      ? 'pass'
      : null;
  const targetDates = supportedVersions
    .filter(version => targetCi == null || version.ci === targetCi)
    .map(version => version.ciDate);

  return [{
    ...base,
    hardware: joinUniqueValues(supportedVersions.map(version => version.hardware)),
    ci: targetCi,
    ciDate: latestDate(targetDates),
  }];
}

export function normalizeVersion(projectType: ProjectType, version: VersionInfo): VersionInfo {
  const base = {
    version: version.version,
    hardware: version.hardware,
    integratedDate: version.integratedDate,
  };

  if (projectType === '鲲鹏') {
    return {
      ...base,
      openEuler: version.openEuler || '',
      functional: version.functional ?? null,
      functionalDate: version.functionalDate ?? null,
      performance: version.performance ?? null,
      performanceDate: version.performanceDate ?? null,
    };
  }

  return {
    ...base,
    ci: version.ci ?? null,
    ciDate: version.ciDate ?? null,
  };
}

export function normalizeProject(project: Project): Project {
  const supportedVersions = project.supportedVersions.map(version => normalizeVersion(project.type, version));
  const base = {
    id: project.id,
    name: project.name,
    type: project.type,
    category: project.category,
    maintainer: project.maintainer,
    supportedVersions: project.type === '昇腾' ? mergeAscendVersions(supportedVersions) : supportedVersions,
  };

  if (project.type === '鲲鹏') {
    return {
      ...base,
      type: '鲲鹏',
      upstream: project.upstream || '',
      latestVersion: project.latestVersion || '',
    };
  }

  return {
    ...base,
    type: '昇腾',
    branch: project.branch || 'main',
    upstream: project.upstream || '',
  };
}
