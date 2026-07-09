import type { ProjectDomain, ProjectRefreshScope } from './projectTypes';

export interface RefreshOptions {
  syncRemote?: boolean;
  domain?: ProjectDomain;
  ascendScope?: ProjectRefreshScope;
}

export function refreshKeyForOptions(options: RefreshOptions) {
  if (options.domain === 'kunpeng') return 'kunpeng';
  if (options.domain === 'ascend') return `ascend:${options.ascendScope || 'project'}`;
  return 'all';
}

function refreshEndpointForOptions(options: RefreshOptions) {
  if (options.domain === 'kunpeng') return '/api/data/kunpeng/refresh';
  if (options.domain === 'ascend') return `/api/data/ascend/${options.ascendScope || 'project'}/refresh`;
  return '/api/data/refresh';
}

export async function requestRemoteSync(options: RefreshOptions = {}) {
  const response = await fetch(refreshEndpointForOptions(options), {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 409) return 'running';
  if (!response.ok) throw new Error(`Remote sync failed: ${response.status}`);
  return 'synced';
}

export async function requestAscendProjectSync(name: string, scope: ProjectRefreshScope) {
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
