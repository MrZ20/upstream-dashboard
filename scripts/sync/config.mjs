import path from 'node:path';

const falseValues = new Set(['0', 'false', 'no', 'off']);

export function readArgValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function readSyncArgs(args = process.argv.slice(2)) {
  const argSet = new Set(args);
  const ascendScope = readArgValue(args, '--ascend-scope') || 'project';

  return {
    loop: argSet.has('--loop'),
    delayFirst: argSet.has('--delay-first'),
    syncDomain: readArgValue(args, '--domain'),
    ascendScope,
    ascendProjectName: readArgValue(args, '--ascend-project'),
    ascendProjectScope: readArgValue(args, '--ascend-project-scope') || ascendScope,
  };
}

export function readSyncConfig(env = process.env) {
  const dataDir = env.DATA_DIR || '/project-data';

  return {
    dataDir,
    kunpengRepoUrl: env.KUNPENG_REPO_URL || 'https://gitcode.com/openeuler/openeuler-docker-images.git',
    kunpengBranch: env.KUNPENG_BRANCH || 'master',
    kunpengTestsPath: env.KUNPENG_TESTS_PATH || 'tests',
    ascendRepoUrl: env.ASCEND_REPO_URL || 'https://github.com/MrZ20/ascend-testdata.git',
    ascendBranch: env.ASCEND_BRANCH || 'main',
    ascendProjectsPath: env.ASCEND_PROJECTS_PATH || 'project',
    sourceCacheDir: env.PROJECT_SOURCE_DIR || path.join(dataDir, '_source-cache'),
    syncIntervalSeconds: Number(env.SYNC_INTERVAL_SECONDS || 24 * 60 * 60),
    syncLockStaleSeconds: Number(env.SYNC_LOCK_STALE_SECONDS || 2 * 60 * 60),
    ascendCiRunScripts: !falseValues.has(String(env.ASCEND_CI_RUN_SCRIPTS || '1').toLowerCase()),
  };
}

export function syncLockPath(config) {
  return path.join(config.dataDir, '.sync.lock');
}

export function cachedAscendRepoRoot(config) {
  return path.join(config.sourceCacheDir, 'ascend');
}

export function cachedAscendProjectsDir(config) {
  return path.join(cachedAscendRepoRoot(config), config.ascendProjectsPath);
}
