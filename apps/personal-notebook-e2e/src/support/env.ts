import path from 'node:path';

import { workspaceRoot } from '@nx/devkit';

/** A throwaway data folder: global setup empties it, so every run starts with no notebooks. */
export const DATA_DIR = path.join(
  workspaceRoot,
  'apps/personal-notebook-e2e/test-output/data',
);
export const DB_PATH = path.join(DATA_DIR, 'notebook.db');

const portForCheckout = (root: string) =>
  51_000 +
  ([...root].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0) %
    9_000);

export const PORT =
  Number(process.env['NOTEBOOK_E2E_PORT']) || portForCheckout(workspaceRoot);
