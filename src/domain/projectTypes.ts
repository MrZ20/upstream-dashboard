export type ProjectType = '鲲鹏' | '昇腾';
export type ProjectDomain = 'kunpeng' | 'ascend';
export type ProjectRefreshScope = 'all' | 'project' | 'ci';
export type FuncStatus = 'pass' | 'fail';
export type PerfStatus = 'improvement' | 'stable' | 'regression';

export interface Maintainer {
  name: string;
  email: string;
}

export interface VersionInfo {
  version: string;
  openEuler?: string;
  hardware: string;
  functional?: FuncStatus | null;
  functionalDate?: string | null;
  performance?: PerfStatus | null;
  performanceDate?: string | null;
  ci?: 'pass' | 'fail' | null;
  ciDate?: string | null;
  integratedDate: string;
}

export interface Project {
  id: number;
  name: string;
  type: ProjectType;
  category: string;
  upstream?: string;
  latestVersion?: string;
  description?: string;
  maintainer?: Maintainer;
  branch?: string;
  supportedVersions: VersionInfo[];
}


export interface SummaryStats {
  totalProjects: number;
  kunpengCount: number;
  ascendCount: number;
  totalVersions: number;
  functionalPassRate: number;
  performancePassRate: number;
  regressionCount: number;
  improvementCount: number;
  ciPassRate: number;
  ciFailCount: number;
  fullyIntegrated: number;
}

export interface DataMetadata {
  lastSyncedAt?: string | null;
  source?: string;
  projectCounts?: Partial<Record<ProjectDomain, number>>;
}
