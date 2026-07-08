import * as fs from 'fs';
import * as path from 'path';
import { defineConfig, type Plugin } from 'vite';

// Vercel's own bundler for api/*.ts is broken for this monorepo (traces/bundles
// the whole pnpm workspace and produces a corrupted function — see the design doc
// for the investigation). The fix is to ship it an already-fully-bundled,
// self-contained JS file instead, so it has nothing left to trace. This copies
// that bundle from dist/ (Nx's normal build output) to api/index.js, the one path
// Vercel's "Fetch Web Standard Export" convention actually reads from.
//
// personal-data's loader.ts locates its data/ directory relative to its own
// bundled module's import.meta.url at runtime — once inlined here, that URL
// becomes this file's own location (apps/personal-mcp/api/index.js), so a copy
// of the data files has to live alongside it too, not just alongside the
// library's own dist output.
function copyToApiDir(): Plugin {
  return {
    name: 'copy-to-api-dir',
    closeBundle() {
      fs.copyFileSync(path.join(__dirname, 'dist/index.js'), path.join(__dirname, 'api/index.js'));
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
