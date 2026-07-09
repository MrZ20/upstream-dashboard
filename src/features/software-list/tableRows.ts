import { Project, ProjectType, FuncStatus, PerfStatus } from '../../domain/projectTypes';
import { joinUniqueValues } from '../../domain/projectFormat';

export interface ProjectTableRow {
  key: string;
  isVersion: boolean;
  groupIndex: number;
  versionIndex?: number;
  name: string;
  category: string;
  upstream?: string;
  latestVersion?: string;
  versionCount: number;
  maintainerName?: string;
  version?: string;
  openEuler?: string;
  hardware?: string;
  functional?: FuncStatus | null;
  functionalDate?: string | null;
  performance?: PerfStatus | null;
  performanceDate?: string | null;
  ci?: string | null;
  ciDate?: string | null;
  branch?: string;
  children?: ProjectTableRow[];
  _project: Project;
}

export function buildProjectRows(projects: Project[], projectType: ProjectType): ProjectTableRow[] {
  return projects.map((project, projectIndex) => {
    const latest = project.supportedVersions[0];
    const versionChildren: ProjectTableRow[] = projectType === '昇腾' ? [] : project.supportedVersions.slice(1).map((version, childIndex) => {
      const versionIndex = childIndex + 1;
      return {
        key: `ver-${project.id}-${versionIndex}`,
        isVersion: true,
        groupIndex: projectIndex,
        versionIndex,
        name: project.name,
        category: project.category,
        versionCount: 0,
        version: version.version,
        openEuler: version.openEuler,
        hardware: version.hardware,
        functional: version.functional,
        functionalDate: version.functionalDate,
        performance: version.performance,
        performanceDate: version.performanceDate,
        ci: version.ci,
        ciDate: version.ciDate,
        _project: project,
      };
    });

    return {
      key: `proj-${project.id}`,
      isVersion: false,
      groupIndex: projectIndex,
      name: project.name,
      category: project.category,
      upstream: project.upstream || '',
      latestVersion: project.latestVersion || '',
      versionCount: project.supportedVersions.length,
      maintainerName: project.maintainer?.name,
      version: latest?.version,
      openEuler: latest?.openEuler,
      hardware: projectType === '昇腾'
        ? joinUniqueValues(project.supportedVersions.map(version => version.hardware))
        : latest?.hardware,
      functional: latest?.functional ?? null,
      functionalDate: latest?.functionalDate ?? null,
      performance: latest?.performance ?? null,
      performanceDate: latest?.performanceDate ?? null,
      ci: latest?.ci ?? null,
      ciDate: latest?.ciDate ?? null,
      branch: project.branch || 'main',
      _project: project,
      children: versionChildren.length > 0 ? versionChildren : undefined,
    };
  });
}
