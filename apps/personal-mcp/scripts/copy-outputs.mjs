// Copies vite build's dist/index.js into api/index.js, the path Vercel's
// "Fetch Web Standard Export" Functions convention actually reads from.
//
// personal-data's loader.ts locates its data/ directory relative to its own
// bundled module's import.meta.url at runtime — once inlined into api/index.js,
// that URL becomes this file's own location, so the data files need a copy
// alongside it too, not just alongside the library's own dist output.
import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiDir = join(appRoot, 'api');

// copyFileSync doesn't create the destination's parent directory itself.
mkdirSync(apiDir, { recursive: true });

copyFileSync(join(appRoot, 'dist/index.js'), join(apiDir, 'index.js'));
cpSync(join(appRoot, '../../libs/personal-data/src/data'), join(apiDir, 'data'), {
  recursive: true,
});
