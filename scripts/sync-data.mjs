#!/usr/bin/env node
import { runSyncCli } from './sync/sync-service.mjs';

await runSyncCli(process.argv.slice(2));
