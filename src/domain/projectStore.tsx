import { createContext, useContext, useMemo, ReactNode } from 'react';
import kunpengIndex from '../data/kunpeng/_index.md?raw';
import ascendIndex from '../data/ascend/_index.md?raw';
import { Project, ProjectType } from './projectTypes';
import { normalizeProject } from './projectNormalize';

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
}

type ProjectSource = Omit<Project, 'id' | 'type'> & Partial<Pick<Project, 'id' | 'type'>>;

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  loading: false,
});

const kunpengModules = import.meta.glob('../data/kunpeng/*.json', { eager: true, import: 'default' }) as Record<string, ProjectSource>;
const ascendModules = import.meta.glob('../data/ascend/*.json', { eager: true, import: 'default' }) as Record<string, ProjectSource>;

function parseIndex(value: string): string[] {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim())
    .filter(Boolean);
}

function readDomainProjects(
  domain: 'kunpeng' | 'ascend',
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
    if (!source) {
      throw new Error(`Missing project data file listed in ${domain}/_index.md: ${fileName}`);
    }
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

const kunpengProjects = readDomainProjects('kunpeng', '鲲鹏', kunpengIndex, kunpengModules, 1);
const ascendProjects = readDomainProjects('ascend', '昇腾', ascendIndex, ascendModules, kunpengProjects.length + 1);
const staticProjects = [...kunpengProjects, ...ascendProjects].map(normalizeProject);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ projects: staticProjects, loading: false }), []);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  return useContext(ProjectContext);
}
