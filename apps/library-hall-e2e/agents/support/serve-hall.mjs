import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SHELVES, startCollections } from './collections.mjs';

/**
 * Starts the fictional collections, then the hall's production build in front of them. The e2e
 * runner starts this as the target's `app.command` and passes the port it picked.
 * Build the hall first: `pnpm nx build library-hall`.
 */
const port = process.argv[2];
if (!port) throw new Error('usage: serve-hall.mjs <port>');

const hall = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../library-hall',
);
const { origin, server } = await startCollections();
const env = { ...process.env };
for (const collection of Object.keys(SHELVES))
  env[`LIBRARY_${collection.toUpperCase()}_URL`] = `${origin}/${collection}`;

const next = spawn(
  resolve(hall, 'node_modules/.bin/next'),
  ['start', '-H', '127.0.0.1', '-p', port],
  { cwd: hall, env, stdio: 'inherit' },
);

const stop = () => {
  next.kill('SIGTERM');
  server.close();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
next.on('exit', (code) => {
  server.close();
  process.exit(code ?? 0);
});
