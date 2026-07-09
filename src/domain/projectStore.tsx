import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Project } from './projectTypes';
import { clientRefreshMs, loadProjects, type LoadResult } from './runtimeDataClient';
import {
  refreshKeyForOptions,
  requestAscendProjectSync,
  requestRemoteSync,
  type RefreshOptions,
} from './refreshClient';
import type { ProjectRefreshScope } from './projectTypes';

export type { ProjectRefreshScope } from './projectTypes';

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
  refreshing: boolean;
  refreshingKey: string | null;
  projectRefreshing: Record<string, boolean>;
  lastUpdated: string | null;
  error: string | null;
  refreshProjects: (options?: RefreshOptions) => Promise<void>;
  refreshAscendProject: (name: string, scope: ProjectRefreshScope) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [projectRefreshing, setProjectRefreshing] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyLoadResult = useCallback((result: LoadResult) => {
    setProjects(result.projects);
    setLastUpdated(result.metadata?.lastSyncedAt || null);
  }, []);

  const refreshProjects = useCallback(async (options: RefreshOptions = {}) => {
    const key = refreshKeyForOptions(options);
    setRefreshingKey(key);
    setRefreshing(true);
    setError(null);

    try {
      if (options.syncRemote) {
        try {
          const syncStatus = await requestRemoteSync(options);
          if (syncStatus === 'running') setError('数据正在同步中，已刷新当前可用数据。');
        } catch (syncError) {
          setError('远端同步接口暂不可用，已刷新当前可用数据。');
          console.warn(syncError);
        }
      }

      const result = await loadProjects(true);
      applyLoadResult(result);
    } catch (loadError) {
      setError('数据刷新失败，已保留当前页面数据。');
      console.warn(loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setRefreshingKey(null);
    }
  }, [applyLoadResult]);

  const refreshAscendProject = useCallback(async (name: string, scope: ProjectRefreshScope) => {
    const key = `${name}:${scope}`;
    setProjectRefreshing(current => ({ ...current, [key]: true }));
    setError(null);

    try {
      const syncStatus = await requestAscendProjectSync(name, scope);
      if (syncStatus === 'running') setError('数据正在同步中，已刷新当前可用数据。');
      const result = await loadProjects(true);
      applyLoadResult(result);
    } catch (projectError) {
      setError(scope === 'ci' ? 'CI 刷新失败，已保留当前页面数据。' : '项目刷新失败，已保留当前页面数据。');
      console.warn(projectError);
    } finally {
      setProjectRefreshing((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setLoading(false);
    }
  }, [applyLoadResult]);

  useEffect(() => {
    let mounted = true;

    loadProjects(false)
      .then((result) => {
        if (mounted) applyLoadResult(result);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [applyLoadResult]);

  useEffect(() => {
    if (!Number.isFinite(clientRefreshMs) || clientRefreshMs <= 0) return undefined;
    const timer = window.setInterval(() => {
      void refreshProjects();
    }, clientRefreshMs);
    return () => window.clearInterval(timer);
  }, [refreshProjects]);

  const value = useMemo(() => ({
    projects,
    loading,
    refreshing,
    refreshingKey,
    projectRefreshing,
    lastUpdated,
    error,
    refreshProjects,
    refreshAscendProject,
  }), [error, lastUpdated, loading, projectRefreshing, projects, refreshing, refreshingKey, refreshAscendProject, refreshProjects]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const value = useContext(ProjectContext);
  if (!value) throw new Error('useProjects must be used within ProjectProvider');
  return value;
}
