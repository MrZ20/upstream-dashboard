import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import kunpengIndex from '../data/kunpeng/_index.md?raw';
import ascendIndex from '../data/ascend/_index.md?raw';
import { Project, ProjectType } from './projectTypes';
import { normalizeProject } from './projectNormalize';

type ProjectSource = Omit<Project, 'id' | 'type'> & Partial<Pick<Project, 'id' | 'type'>>;
type ProjectDomain = 'kunpeng' | 'ascend';
type DataSource = 'runtime' | 'bundled';
export type ProjectRefreshScope = 'all' | 'project' | 'ci';

interface DataMetadata {
  lastSyncedAt?: string | null;
  source?: string;
  projectCounts?: Partial<Record<ProjectDomain, number>>;
}

interface LoadResult {
  projects: Project[];
  metadata?: DataMetadata;
  source: DataSource;
}

interface RefreshOptions {
  syncRemote?: boolean;
  domain?: ProjectDomain;
  ascendScope?: ProjectRefreshScope;
}

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
  refreshing: boolean;
  refreshingKey: string | null;
  projectRefreshing: Record<string, boolean>;
  lastUpdated: string | null;
  dataSource: DataSource;
  error: string | null;
  refreshProjects: (options?: RefreshOptions) => Promise<void>;
  refreshAscendProject: (name: string, scope: ProjectRefreshScope) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

const runtimeDataBase = normalizeBase(import.meta.env.VITE_RUNTIME_DATA_BASE || '/runtime-data');
const clientRefreshMs = Number(import.meta.env.VITE_CLIENT_DATA_REFRESH_MS || 5 * 60 * 1000);

const kunpengModules = import.meta.glob('../data/kunpeng/*.json', { eager: true, import: 'default' }) as Record<string, ProjectSource>;
const ascendModules = import.meta.glob('../data/ascend/*.json', { eager: true, import: 'default' }) as Record<string, ProjectSource>;

function normalizeBase(value: string) {
  return value.replace(/\/+$/, '');
}

function cacheSuffix(cacheBust: boolean) {
  return cacheBust ? `?t=${Date.now()}` : '';
}

function parseIndex(value: string): string[] {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim())
    .filter(Boolean);
}

function readDomainProjects(
  domain: ProjectDomain,
  type: ProjectType,
  indexText: string,
  modules: Record<string, ProjectSource>,
  startId: number,
) {
  const projects: Project[] = [];
  const seenNames = new Set<string>();

  parseIndex(indexText).forEach((fileName) => {
    const moduleKey = `../data/${domain}/${fileName}`;
    const source = modules[moduleKey];
    if (!source) return;
    if (seenNames.has(source.name)) return;

    seenNames.add(source.name);
    projects.push({
      ...source,
      id: startId + projects.length,
      type,
    });
  });

  return projects;
}

const bundledKunpengProjects = readDomainProjects('kunpeng', '鲲鹏', kunpengIndex, kunpengModules, 1);
const bundledAscendProjects = readDomainProjects('ascend', '昇腾', ascendIndex, ascendModules, bundledKunpengProjects.length + 1);
const bundledProjects = [...bundledKunpengProjects, ...bundledAscendProjects].map(normalizeProject);

async function fetchRuntimeText(path: string, cacheBust: boolean) {
  const response = await fetch(`${runtimeDataBase}/${path}${cacheSuffix(cacheBust)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load runtime data: ${path}`);
  return response.text();
}

async function fetchRuntimeJson<T>(path: string, cacheBust: boolean) {
  const response = await fetch(`${runtimeDataBase}/${path}${cacheSuffix(cacheBust)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load runtime data: ${path}`);
  return response.json() as Promise<T>;
}

async function readRuntimeDomainProjects(
  domain: ProjectDomain,
  type: ProjectType,
  startId: number,
  cacheBust: boolean,
) {
  const indexText = await fetchRuntimeText(`${domain}/_index.md`, cacheBust);
  const projects: Project[] = [];
  const seenNames = new Set<string>();

  for (const fileName of parseIndex(indexText)) {
    try {
      const source = await fetchRuntimeJson<ProjectSource>(`${domain}/${fileName}`, cacheBust);
      if (!source.name || !Array.isArray(source.supportedVersions) || seenNames.has(source.name)) continue;
      seenNames.add(source.name);
      projects.push(normalizeProject({
        ...source,
        id: startId + projects.length,
        type,
      }));
    } catch (error) {
      console.warn(`Skip unavailable runtime project ${domain}/${fileName}`, error);
    }
  }

  return projects;
}

async function readRuntimeMetadata(cacheBust: boolean): Promise<DataMetadata | undefined> {
  try {
    return await fetchRuntimeJson<DataMetadata>('metadata.json', cacheBust);
  } catch {
    return undefined;
  }
}

async function loadRuntimeProjects(cacheBust: boolean): Promise<LoadResult> {
  const kunpeng = await readRuntimeDomainProjects('kunpeng', '鲲鹏', 1, cacheBust);
  const ascend = await readRuntimeDomainProjects('ascend', '昇腾', kunpeng.length + 1, cacheBust);
  const projects = [...kunpeng, ...ascend];
  if (!projects.length) throw new Error('Runtime data is empty');

  return {
    projects,
    metadata: await readRuntimeMetadata(cacheBust),
    source: 'runtime',
  };
}

function loadBundledProjects(): LoadResult {
  return {
    projects: bundledProjects,
    source: 'bundled',
  };
}

async function loadProjects(cacheBust = false): Promise<LoadResult> {
  try {
    return await loadRuntimeProjects(cacheBust);
  } catch (error) {
    console.warn('Use bundled project data fallback.', error);
    return loadBundledProjects();
  }
}

function refreshKeyForOptions(options: RefreshOptions) {
  if (options.domain === 'kunpeng') return 'kunpeng';
  if (options.domain === 'ascend') return `ascend:${options.ascendScope || 'project'}`;
  return 'all';
}

function refreshEndpointForOptions(options: RefreshOptions) {
  if (options.domain === 'kunpeng') return '/api/data/kunpeng/refresh';
  if (options.domain === 'ascend') return `/api/data/ascend/${options.ascendScope || 'project'}/refresh`;
  return '/api/data/refresh';
}

async function requestRemoteSync(options: RefreshOptions = {}) {
  const response = await fetch(refreshEndpointForOptions(options), {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 409) return 'running';
  if (!response.ok) throw new Error(`Remote sync failed: ${response.status}`);
  return 'synced';
}


async function requestAscendProjectSync(name: string, scope: ProjectRefreshScope) {
  const response = await fetch(`/api/projects/ascend/${encodeURIComponent(name)}/${scope}/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 409) return 'running';
  if (!response.ok) {
    let message = `Ascend project sync failed: ${response.status}`;
    try {
      const body = await response.json() as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Keep the status-based message if the response body is not JSON.
    }
    throw new Error(message);
  }
  return 'synced';
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(bundledProjects);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [projectRefreshing, setProjectRefreshing] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('bundled');
  const [error, setError] = useState<string | null>(null);

  const applyLoadResult = useCallback((result: LoadResult) => {
    setProjects(result.projects);
    setDataSource(result.source);
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
      .catch((loadError) => {
        if (mounted) setError('数据加载失败，已使用内置数据。');
        console.warn(loadError);
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
    dataSource,
    error,
    refreshProjects,
    refreshAscendProject,
  }), [dataSource, error, lastUpdated, loading, projectRefreshing, projects, refreshing, refreshingKey, refreshAscendProject, refreshProjects]);

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
