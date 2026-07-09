import { normalizeProject } from './projectNormalize';
import type { DataMetadata, Project, ProjectDomain, ProjectType } from './projectTypes';

type ProjectSource = Omit<Project, 'id' | 'type'> & Partial<Pick<Project, 'id' | 'type'>>;

export interface LoadResult {
  projects: Project[];
  metadata?: DataMetadata;
}

const runtimeDataBase = normalizeBase(import.meta.env.VITE_RUNTIME_DATA_BASE || '/runtime-data');
export const clientRefreshMs = Number(import.meta.env.VITE_CLIENT_DATA_REFRESH_MS || 5 * 60 * 1000);

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
  const metadata = await readRuntimeMetadata(cacheBust);
  const kunpeng = await readRuntimeDomainProjects('kunpeng', '鲲鹏', 1, cacheBust);
  const ascend = await readRuntimeDomainProjects('ascend', '昇腾', kunpeng.length + 1, cacheBust);

  return {
    projects: [...kunpeng, ...ascend],
    metadata,
  };
}

export async function loadProjects(cacheBust = false): Promise<LoadResult> {
  try {
    return await loadRuntimeProjects(cacheBust);
  } catch (error) {
    console.warn('Runtime project data unavailable.', error);
    return {
      projects: [],
      };
  }
}
