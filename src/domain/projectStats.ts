import { Project, SummaryStats } from './projectTypes';

export interface RiskItem {
  key: string;
  name: string;
  type: Project['type'];
  category: string;
  maintainer: Project['maintainer'];
  version: string;
  func?: string | null;
  funcDate?: string | null;
  perfStatus?: string | null;
  perfDate?: string | null;
  ci?: string | null;
  ciDate?: string | null;
}

export function getProjectStats(projects: Project[]): SummaryStats {
  let totalVersions = 0;
  let totalFunctional = 0, functionalPass = 0;
  let totalPerf = 0, perfPass = 0;
  let regressionCount = 0, improvementCount = 0;
  let totalCi = 0, ciPass = 0, ciFail = 0;
  let fullyIntegrated = 0;

  for (const p of projects) {
    totalVersions += p.supportedVersions.length;
    if (p.supportedVersions.length >= 2) fullyIntegrated++;

    const latest = p.supportedVersions[0];
    if (latest) {
      if (latest.functional != null) {
        totalFunctional++;
        if (latest.functional === 'pass') functionalPass++;
      }
      if (latest.performance != null) {
        totalPerf++;
        if (latest.performance !== 'regression') perfPass++;
        if (latest.performance === 'regression') regressionCount++;
        if (latest.performance === 'improvement') improvementCount++;
      }
      if (latest.ci != null) {
        totalCi++;
        if (latest.ci === 'pass') ciPass++;
        if (latest.ci === 'fail') ciFail++;
      }
    }
  }

  return {
    totalProjects: projects.length,
    kunpengCount: 0,
    ascendCount: 0,
    totalVersions,
    functionalPassRate: totalFunctional > 0 ? (functionalPass / totalFunctional) * 100 : 0,
    performancePassRate: totalPerf > 0 ? (perfPass / totalPerf) * 100 : 0,
    regressionCount,
    improvementCount,
    ciPassRate: totalCi > 0 ? (ciPass / totalCi) * 100 : 0,
    ciFailCount: ciFail,
    fullyIntegrated,
  };
}

export function getCategoryMap(projects: Project[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of projects) {
    map[p.category] = (map[p.category] || 0) + 1;
  }
  return map;
}

export function getRiskItems(projects: Project[], limit = 20): RiskItem[] {
  return projects.flatMap(p =>
    p.supportedVersions
      .filter(v => {
        if (p.type === '昇腾') return v.ci === 'fail';
        return v.functional === 'fail' || v.performance === 'regression';
      })
      .map(v => ({
        key: `${p.id}-${v.version}`,
        name: p.name,
        type: p.type,
        category: p.category,
        maintainer: p.maintainer,
        version: v.version,
        func: v.functional,
        funcDate: v.functionalDate,
        perfStatus: v.performance,
        perfDate: v.performanceDate,
        ci: v.ci,
        ciDate: v.ciDate,
      })),
  ).slice(0, limit);
}
