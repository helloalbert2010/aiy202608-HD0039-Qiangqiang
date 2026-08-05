import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { configFromEnv, createMobileApiServer } from './server.js';

const envFile = resolve(import.meta.dirname, '..', '.env.local');
if (existsSync(envFile)) loadEnvFile(envFile);

const config = configFromEnv();
const server = createMobileApiServer(config);

server.listen(config.port, config.host, () => {
  console.log('[myarchive-api] listening on http://' + config.host + ':' + config.port);
  console.log('[myarchive-api] databaseConfigured=' + Boolean(config.supabaseUrl && config.supabasePublishableKey) + ' agentConfigured=' + Boolean(config.agentApiUrl && config.agentApiKey));
});

server.on('error', (error) => {
  console.error('[myarchive-api] startup failed: ' + (error.code || 'UNKNOWN_ERROR'));
  process.exitCode = 1;
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
