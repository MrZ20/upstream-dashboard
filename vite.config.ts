import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const projectFiles = {
  kunpeng: path.join(rootDir, 'src/data/kunpengProjects.json'),
  ascend: path.join(rootDir, 'src/data/ascendProjects.json'),
};
const operationLogFile = path.join(rootDir, 'src/data/operationLogs.json');

type ProjectDomain = keyof typeof projectFiles;
type OperationAction = 'add' | 'update' | 'delete';

function isDomain(value: string): value is ProjectDomain {
  return value === 'kunpeng' || value === 'ascend';
}

async function readProjects(domain: ProjectDomain) {
  return JSON.parse(await fs.readFile(projectFiles[domain], 'utf8'));
}

async function writeProjects(domain: ProjectDomain, projects: unknown[]) {
  await fs.writeFile(projectFiles[domain], `${JSON.stringify(projects, null, 2)}\n`);
}

async function readOperationLogs() {
  try {
    return JSON.parse(await fs.readFile(operationLogFile, 'utf8'));
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeOperationLogs(logs: unknown[]) {
  await fs.writeFile(operationLogFile, `${JSON.stringify(logs.slice(0, 100), null, 2)}\n`);
}

function summarizeProject(project: any) {
  if (!project) return '未知项目';
  return `${project.type || ''}${project.name ? ` ${project.name}` : ''}`.trim() || '未知项目';
}

function summarizeChange(action: OperationAction, beforeProject: any, afterProject: any) {
  if (action === 'add') return `新增 ${summarizeProject(afterProject)}`;
  if (action === 'delete') return `删除 ${summarizeProject(beforeProject)}`;
  return `修改 ${summarizeProject(afterProject || beforeProject)}`;
}

async function appendOperationLog(action: OperationAction, beforeProject: any, afterProject: any) {
  const target = afterProject || beforeProject || {};
  const logs = await readOperationLogs();
  const nextLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    projectId: Number(target.id) || 0,
    projectName: String(target.name || ''),
    projectType: target.type === '昇腾' ? '昇腾' : '鲲鹏',
    time: new Date().toISOString(),
    summary: summarizeChange(action, beforeProject, afterProject),
    before: beforeProject || null,
    after: afterProject || null,
  };

  await writeOperationLogs([nextLog, ...logs].slice(0, 100));
}

async function readCatalog() {
  const [kunpeng, ascend] = await Promise.all([
    readProjects('kunpeng'),
    readProjects('ascend'),
  ]);
  return { kunpeng, ascend };
}

function normalizeProject(domain: ProjectDomain, project: any) {
  const supportedVersions = Array.isArray(project.supportedVersions) ? project.supportedVersions : [];

  if (domain === 'kunpeng') {
    return {
      id: Number(project.id),
      name: String(project.name || ''),
      type: '鲲鹏',
      category: String(project.category || ''),
      upstream: String(project.upstream || ''),
      latestVersion: String(project.latestVersion || ''),
      maintainer: project.maintainer,
      supportedVersions: supportedVersions.map((version: any) => ({
        version: String(version.version || ''),
        openEuler: String(version.openEuler || ''),
        hardware: String(version.hardware || ''),
        functional: version.functional ?? null,
        functionalDate: version.functionalDate ?? null,
        performance: version.performance ?? null,
        performanceDate: version.performanceDate ?? null,
        integratedDate: String(version.integratedDate || ''),
      })),
    };
  }

  return {
    id: Number(project.id),
    name: String(project.name || ''),
    type: '昇腾',
    category: String(project.category || ''),
    branch: String(project.branch || 'main'),
    upstream: String(project.upstream || ''),
    maintainer: project.maintainer,
    supportedVersions: supportedVersions.map((version: any) => ({
      version: String(version.version || ''),
      hardware: String(version.hardware || ''),
      ci: version.ci ?? null,
      ciDate: version.ciDate ?? null,
      integratedDate: String(version.integratedDate || ''),
    })),
  };
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function projectsApi(): Plugin {
  return {
    name: 'projects-json-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/operation-logs')) {
          const url = new URL(req.url, 'http://localhost');
          if (req.method === 'GET' && url.pathname === '/api/operation-logs') {
            sendJson(res, 200, { logs: await readOperationLogs() });
            return;
          }

          sendJson(res, 405, { message: 'Method not allowed' });
          return;
        }

        if (!req.url?.startsWith('/api/projects')) {
          next();
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const [domainPart, idPart] = url.pathname.replace(/^\/api\/projects\/?/, '').split('/');

        try {
          if (req.method === 'GET' && url.pathname === '/api/projects') {
            const { kunpeng, ascend } = await readCatalog();
            sendJson(res, 200, {
              kunpeng,
              ascend,
              projects: [...kunpeng, ...ascend],
            });
            return;
          }

          if (!domainPart || !isDomain(domainPart)) {
            sendJson(res, 404, { message: 'Unknown project domain' });
            return;
          }

          if (req.method === 'GET' && url.pathname === `/api/projects/${domainPart}`) {
            sendJson(res, 200, await readProjects(domainPart));
            return;
          }

          if (req.method === 'POST' && url.pathname === `/api/projects/${domainPart}`) {
            const payload = await readBody(req);
            const { kunpeng, ascend } = await readCatalog();
            const allProjects = [...kunpeng, ...ascend];
            const nextId = allProjects.length > 0 ? Math.max(...allProjects.map((p: any) => Number(p.id) || 0)) + 1 : 1;
            const current = domainPart === 'kunpeng' ? kunpeng : ascend;
            const project = normalizeProject(domainPart, {
              ...payload,
              id: Number(payload.id) > 0 ? payload.id : nextId,
            });
            await writeProjects(domainPart, [...current, project]);
            await appendOperationLog('add', null, project);
            sendJson(res, 201, project);
            return;
          }

          if (req.method === 'PUT' && idPart) {
            const id = Number(idPart);
            const payload = await readBody(req);
            const { kunpeng, ascend } = await readCatalog();
            const previous = [...kunpeng, ...ascend].find((p: any) => Number(p.id) === id) || null;
            const nextKunpeng = kunpeng.filter((p: any) => Number(p.id) !== id);
            const nextAscend = ascend.filter((p: any) => Number(p.id) !== id);
            const project = normalizeProject(domainPart, { ...payload, id });

            if (domainPart === 'kunpeng') {
              nextKunpeng.push(project);
            } else {
              nextAscend.push(project);
            }

            await Promise.all([
              writeProjects('kunpeng', nextKunpeng),
              writeProjects('ascend', nextAscend),
            ]);
            await appendOperationLog('update', previous, project);
            sendJson(res, 200, project);
            return;
          }

          if (req.method === 'DELETE' && idPart) {
            const id = Number(idPart);
            const { kunpeng, ascend } = await readCatalog();
            const previous = [...kunpeng, ...ascend].find((p: any) => Number(p.id) === id) || null;
            await Promise.all([
              writeProjects('kunpeng', kunpeng.filter((p: any) => Number(p.id) !== id)),
              writeProjects('ascend', ascend.filter((p: any) => Number(p.id) !== id)),
            ]);
            if (previous) await appendOperationLog('delete', previous, null);
            sendJson(res, 200, { ok: true });
            return;
          }

          sendJson(res, 405, { message: 'Method not allowed' });
        } catch (error) {
          sendJson(res, 500, { message: error instanceof Error ? error.message : 'Unknown error' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [projectsApi(), react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
