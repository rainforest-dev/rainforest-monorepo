// Copies vite build's dist/index.js into api/index.js, the path Vercel's
// "Fetch Web Standard Export" Functions convention actually reads from.
//
// personal-data's loader.ts locates its data/ directory relative to its own
// bundled module's import.meta.url at runtime — once inlined into api/index.js,
// that URL becomes this file's own location, so the data files need a copy
// alongside it too, not just alongside the library's own dist output.
//
// dist/ then gets replaced with a small placeholder. Vercel's own build CLI
// needs *some* real (non-hidden) file there to keep its Nx output-directory
// check satisfied — a dist/.gitkeep alone produced "No Output Directory named
// 'dist' found" — but leaving the actual multi-MB bundle there backfired
// differently: Vercel auto-detected dist/ as legitimate static site output and
// served index.js itself as a public static file at the site root, which
// *also* dropped api/ Functions detection entirely (same failure mode as
// explicitly overriding "Output Directory", just triggered automatically).
// A trivial placeholder file satisfies the existence check without qualifying
// as meaningful static content.
import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiDir = join(appRoot, 'api');
const distDir = join(appRoot, 'dist');

// copyFileSync doesn't create the destination's parent directory itself.
mkdirSync(apiDir, { recursive: true });

copyFileSync(join(distDir, 'index.js'), join(apiDir, 'index.js'));
cpSync(join(appRoot, '../../libs/personal-data/src/data'), join(apiDir, 'data'), {
  recursive: true,
});

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'placeholder.txt'), 'See ../api/ for the actual deployed function.\n');
