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
    versions: project.versions.map(version => normalizeVersion(project.type, version)),
  };

  if (project.type === '鲲鹏') {
    return {
      ...base,
      type: '鲲鹏',
      upstream: project.upstream || '',
      upstreamVersion: project.upstreamVersion || '',
    };
  }

  return {
    ...base,
    type: '昇腾',
    branch: project.branch || 'main',
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
        const versions = [
          ...current.versions,
          normalizeVersion(current.type, action.payload.version),
        ];
        versions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
        await saveProject({ ...current, versions: versions });
        return;
      }
      case 'UPDATE_VERSION': {
        const current = projects.find(p => p.id === action.payload.projectId);
        if (!current) return;
        const versions = [...current.versions];
        versions[action.payload.versionIndex] = normalizeVersion(current.type, action.payload.version);
        versions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
        await saveProject({ ...current, versions: versions });
        return;
      }
      case 'DELETE_VERSION': {
        const current = projects.find(p => p.id === action.payload.projectId);
        if (!current) return;
        const versions = [...current.versions];
        versions.splice(action.payload.versionIndex, 1);
        await saveProject({ ...current, versions: versions });
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
