export function normalizeStatus(value) {
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

export function asProjectCandidates(raw) {
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

export function normalizeProject(project, softwareName, forcedDomain) {
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
