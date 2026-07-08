import * as fs from 'fs';
import * as path from 'path';
import { defineConfig, type Plugin } from 'vite';

// Vercel's own bundler for api/*.ts is broken for this monorepo (traces/bundles
// the whole pnpm workspace and produces a corrupted function — see the design doc
// for the investigation). The fix is to ship it an already-fully-bundled,
// self-contained JS file instead, so it has nothing left to trace. Building
// straight into api/ (rather than dist/ + a post-build copy) also sidesteps a
// real ENOENT race seen on Vercel's build filesystem, where a closeBundle-time
// fs.copyFileSync ran before Rolldown's own disk write had actually landed.
//
// personal-data's loader.ts locates its data/ directory relative to its own
// bundled module's import.meta.url at runtime — once inlined here, that URL
// becomes this file's own location (apps/personal-mcp/api/index.js), so a copy
// of the data files has to live alongside it too, not just alongside the
// library's own dist output. writeBundle (not closeBundle) is used here since
// it's the hook Rollup/Rolldown documents as running after bundle files are
// actually written to disk.
function copyDataDir(): Plugin {
  return {
    name: 'copy-data-dir',
    writeBundle() {
      fs.cpSync(
        path.join(__dirname, '../../libs/personal-data/src/data'),
        path.join(__dirname, 'api/data'),
        { recursive: true },
      );
    },
  };
}

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/personal-mcp',
  plugins: [copyDataDir()],
  build: {
    outDir: './api',
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
