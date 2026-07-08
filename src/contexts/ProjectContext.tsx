import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Project, Maintainer, VersionInfo, ProjectType } from '../types';

type Action =
  | { type: 'ADD_PROJECT'; payload: Omit<Project, 'id'> }
  | { type: 'UPDATE_PROJECT'; payload: { id: number; data: Partial<Project> } }
  | { type: 'DELETE_PROJECT'; payload: { id: number } }
  | { type: 'SET_MAINTAINER'; payload: { id: number; maintainer: Maintainer | null } }
  | { type: 'ADD_VERSION'; payload: { projectId: number; version: VersionInfo } }
  | { type: 'UPDATE_VERSION'; payload: { projectId: number; versionIndex: number; version: VersionInfo } }
  | { type: 'DELETE_VERSION'; payload: { projectId: number; versionIndex: number } };

type DispatchAction = (action: Action) => Promise<void>;

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
  dispatch: DispatchAction;
  reload: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  loading: false,
  dispatch: async () => {},
  reload: async () => {},
});

function domainFromType(type: ProjectType) {
  return type === '昇腾' ? 'ascend' : 'kunpeng';
}

function splitMultiValue(value?: string) {
  return (value || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);
}

function joinUniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.flatMap(splitMultiValue))].join('; ');
}

function latestDate(values: Array<string | null | undefined>) {
  const sorted = values.filter(Boolean).sort();
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function mergeAscendVersions(supportedVersions: VersionInfo[]): VersionInfo[] {
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

function normalizeVersion(projectType: ProjectType, version: VersionInfo): VersionInfo {
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

function normalizeProject(project: Project): Project {
  const base = {
    id: project.id,
    name: project.name,
    type: project.type,
    category: project.category,
    maintainer: project.maintainer,
    supportedVersions: project.type === '昇腾'
      ? mergeAscendVersions(project.supportedVersions.map(version => normalizeVersion(project.type, version)))
      : project.supportedVersions.map(version => normalizeVersion(project.type, version)),
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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `请求失败: ${response.status}`);
  }

  return response.json();
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson<{ projects: Project[] }>('/api/projects');
      setProjects(data.projects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveProject = useCallback(async (project: Project) => {
    const normalized = normalizeProject(project);
    await requestJson(`/api/projects/${domainFromType(normalized.type)}/${normalized.id}`, {
      method: 'PUT',
      body: JSON.stringify(normalized),
    });
    await reload();
  }, [reload]);

  const dispatch = useCallback<DispatchAction>(async (action) => {
    switch (action.type) {
      case 'ADD_PROJECT': {
        const project = normalizeProject({ ...action.payload, id: 0 });
        await requestJson(`/api/projects/${domainFromType(project.type)}`, {
          method: 'POST',
          body: JSON.stringify(project),
        });
        await reload();
        return;
      }
      case 'UPDATE_PROJECT': {
        const current = projects.find(p => p.id === action.payload.id);
        if (!current) return;
        await saveProject({ ...current, ...action.payload.data });
        return;
      }
      case 'DELETE_PROJECT': {
        const current = projects.find(p => p.id === action.payload.id);
        const domain = current ? domainFromType(current.type) : 'kunpeng';
        await requestJson(`/api/projects/${domain}/${action.payload.id}`, { method: 'DELETE' });
        await reload();
        return;
      }
      case 'SET_MAINTAINER': {
        const current = projects.find(p => p.id === action.payload.id);
        if (!current) return;
        await saveProject({ ...current, maintainer: action.payload.maintainer ?? undefined });
        return;
      }
      case 'ADD_VERSION': {
        const current = projects.find(p => p.id === action.payload.projectId);
        if (!current) return;
        const supportedVersions = [
          ...current.supportedVersions,
          normalizeVersion(current.type, action.payload.version),
        ];
        supportedVersions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
        await saveProject({
          ...current,
          supportedVersions: current.type === '昇腾' ? mergeAscendVersions(supportedVersions) : supportedVersions,
        });
        return;
      }
      case 'UPDATE_VERSION': {
        const current = projects.find(p => p.id === action.payload.projectId);
        if (!current) return;
        const supportedVersions = [...current.supportedVersions];
        supportedVersions[action.payload.versionIndex] = normalizeVersion(current.type, action.payload.version);
        supportedVersions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
        await saveProject({
          ...current,
          supportedVersions: current.type === '昇腾' ? mergeAscendVersions(supportedVersions) : supportedVersions,
        });
        return;
      }
      case 'DELETE_VERSION': {
        const current = projects.find(p => p.id === action.payload.projectId);
        if (!current) return;
        const supportedVersions = [...current.supportedVersions];
        supportedVersions.splice(action.payload.versionIndex, 1);
        await saveProject({ ...current, supportedVersions: supportedVersions });
        return;
      }
      default:
    }
  }, [projects, reload, saveProject]);

  const value = useMemo(() => ({ projects, loading, dispatch, reload }), [projects, loading, dispatch, reload]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  return useContext(ProjectContext);
}
