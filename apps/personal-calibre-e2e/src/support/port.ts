import { workspaceRoot } from '@nx/devkit';

const portForCheckout = (root: string) =>
  50_000 +
  ([...root].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0) %
    10_000);

export const PORT =
  Number(process.env['CALIBRE_E2E_PORT']) || portForCheckout(workspaceRoot);
