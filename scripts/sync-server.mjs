#!/usr/bin/env node
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || '/project-data';
const PORT = Number(process.env.SYNC_SERVER_PORT || 3001);
const SCRIPT_PATH = process.env.SYNC_SCRIPT_PATH || path.join(process.cwd(), 'scripts/sync-data.mjs');
let syncing = false;

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function sendText(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  response.end(body);
}

function contentType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.md')) return 'text/markdown; charset=utf-8';
  return 'application/octet-stream';
}

function runtimeFilePath(url) {
  const requestUrl = new URL(url, 'http://localhost');
  if (!requestUrl.pathname.startsWith('/runtime-data/')) return null;

  const relativePath = decodeURIComponent(requestUrl.pathname.slice('/runtime-data/'.length));
  if (relativePath === '_source-cache' || relativePath.startsWith('_source-cache/')) return null;
  const target = path.resolve(DATA_DIR, relativePath);
  const base = path.resolve(DATA_DIR);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) return null;
  return target;
}

async function readMetadata() {
  try {
    const text = await fs.readFile(path.join(DATA_DIR, 'metadata.json'), 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function sendRuntimeFile(request, response) {
  const target = runtimeFilePath(request.url || '');
  if (!target) {
    sendJson(response, 404, { ok: false, message: 'not found' });
    return true;
  }

  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw new Error('not a file');
    const body = await fs.readFile(target);
    response.writeHead(200, {
      'Content-Type': contentType(target),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    response.end(body);
  } catch {
    sendJson(response, 404, { ok: false, message: 'runtime data not found' });
  }
  return true;
}

function runSync(extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, ...extraArgs], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `sync-data exited with ${code}`));
    });
  });
}


function matchAscendProjectRefresh(pathname) {
  const match = pathname.match(/^\/api\/projects\/ascend\/([^/]+)\/(all|project|ci)\/refresh$/);
  if (!match) return null;
  return {
    projectName: decodeURIComponent(match[1]),
    scope: match[2],
  };
}


function matchDomainRefresh(pathname) {
  if (pathname === '/api/data/kunpeng/refresh') {
    return { domain: 'kunpeng', args: ['--domain', 'kunpeng'] };
  }

  const ascendMatch = pathname.match(/^\/api\/data\/ascend\/(all|project|ci)\/refresh$/);
  if (!ascendMatch) return null;
  return {
    domain: 'ascend',
    scope: ascendMatch[1],
    args: ['--domain', 'ascend', '--ascend-scope', ascendMatch[1]],
  };
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', 'http://localhost');

  if (request.method === 'GET' && requestUrl.pathname.startsWith('/runtime-data/')) {
    await sendRuntimeFile(request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/data/status') {
    sendJson(response, 200, { metadata: await readMetadata(), syncing });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/data/refresh') {
    if (syncing) {
      sendJson(response, 409, { ok: false, message: 'sync already running' });
      return;
    }

    syncing = true;
    try {
      const result = await runSync();
      sendJson(response, 200, { ok: true, metadata: await readMetadata(), output: result.stdout.trim() });
    } catch (error) {
      const status = /already running/i.test(error.message) ? 409 : 500;
      sendJson(response, status, { ok: false, message: error.message });
    } finally {
      syncing = false;
    }
    return;
  }


  const domainRefresh = matchDomainRefresh(requestUrl.pathname);
  if (request.method === 'POST' && domainRefresh) {
    if (syncing) {
      sendJson(response, 409, { ok: false, message: 'sync already running' });
      return;
    }

    syncing = true;
    try {
      const result = await runSync(domainRefresh.args);
      sendJson(response, 200, {
        ok: true,
        domain: domainRefresh.domain,
        scope: domainRefresh.scope,
        metadata: await readMetadata(),
        output: result.stdout.trim(),
      });
    } catch (error) {
      const status = /already running/i.test(error.message) ? 409 : 500;
      sendJson(response, status, { ok: false, message: error.message });
    } finally {
      syncing = false;
    }
    return;
  }



  const ascendProjectRefresh = matchAscendProjectRefresh(requestUrl.pathname);
  if (request.method === 'POST' && ascendProjectRefresh) {
    if (syncing) {
      sendJson(response, 409, { ok: false, message: 'sync already running' });
      return;
    }

    syncing = true;
    try {
      const result = await runSync([
        '--ascend-project', ascendProjectRefresh.projectName,
        '--ascend-project-scope', ascendProjectRefresh.scope,
      ]);
      sendJson(response, 200, {
        ok: true,
        projectName: ascendProjectRefresh.projectName,
        scope: ascendProjectRefresh.scope,
        metadata: await readMetadata(),
        output: result.stdout.trim(),
      });
    } catch (error) {
      const status = /already running/i.test(error.message) ? 409 : 500;
      sendJson(response, status, { ok: false, message: error.message });
    } finally {
      syncing = false;
    }
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
    sendText(response, 200, 'ok\n');
    return;
  }

  sendJson(response, 404, { ok: false, message: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Data sync server listening on 127.0.0.1:${PORT}`);
});
