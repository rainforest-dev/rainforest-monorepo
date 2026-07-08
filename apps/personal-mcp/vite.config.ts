import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { defineConfig, type Plugin } from 'vite';

// Vercel's own bundler for api/*.ts is broken for this monorepo (traces/bundles
// the whole pnpm workspace and produces a corrupted function — see the design doc
// for the investigation). The fix is to ship it an already-fully-bundled,
// self-contained JS file instead, so it has nothing left to trace.
//
// This builds to dist/ (Vite's default convention) via the plain @nx/vite:build
// executor — inferred automatically from this file's presence, not a custom
// nx:run-commands override — since Functions auto-detection for api/ worked
// correctly on this exact project before a custom build target override was
// introduced. Whether that's the actual cause is unconfirmed; testing it here.
//
// personal-data's loader.ts locates its data/ directory relative to its own
// bundled module's import.meta.url at runtime — once inlined into api/index.js,
// that URL becomes this file's own location, so the data files need a copy
// alongside it too, not just alongside the library's own dist output.
//
// dist/ ends up holding a small placeholder.txt, not the real bundle: Vercel's
// `vercel build` CLI needs *some* real (non-hidden) file there to keep its Nx
// output-directory check satisfied — dist/.gitkeep alone produced "No Output
// Directory named 'dist' found" — but the actual multi-MB bundle backfired
// differently: Vercel auto-detected dist/ as legitimate static site output and
// served index.js itself as a public static file at the site root, which also
// dropped api/ Functions detection. A trivial placeholder satisfies the
// existence check without qualifying as meaningful static content.
//
// The earlier version of this copy step (as a Rollup/Rolldown closeBundle or
// writeBundle plugin hook) reliably hit ENOENT on the api/index.js copy. That
// turned out to be a plain missing mkdir — fs.copyFileSync doesn't create the
// destination's parent directory — not an async timing issue with Rolldown's
// binding as it first appeared; the mkdirSync below is the actual fix.
function copyToApiDir(): Plugin {
  return {
    name: 'copy-to-api-dir',
    closeBundle() {
      const apiDir = join(__dirname, 'api');
      const distDir = join(__dirname, 'dist');

      mkdirSync(apiDir, { recursive: true });
      copyFileSync(join(distDir, 'index.js'), join(apiDir, 'index.js'));
      cpSync(join(__dirname, '../../libs/personal-data/src/data'), join(apiDir, 'data'), {
        recursive: true,
      });

      rmSync(distDir, { recursive: true, force: true });
      mkdirSync(distDir, { recursive: true });
      writeFileSync(join(distDir, 'placeholder.txt'), 'See ../api/ for the actual deployed function.\n');
    },
  };
}

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/personal-mcp',
  plugins: [copyToApiDir()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    ssr: 'src/index.ts',
    target: 'node22',
    rollupOptions: {
      output: {
        format: 'esm',
        entryFileNames: 'index.js',
      },
    },
  },
  ssr: {
    // Inline every dependency (hono, mcp-handler, zod, the MCP SDK,
    // @rainforest-dev/personal-data) instead of leaving them as external
    // imports — the deployed function must be fully self-contained.
    noExternal: true,
  },
});
