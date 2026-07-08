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
//
// Vercel's own `vercel build` CLI has a separate, simplistic Nx-detection layer
// that expects an output directory named `dist` for this project (it reads
// nx.json's global targetDefaults.build.outputs literally, ignoring this
// project's own build target override) — an empty dist/ here just satisfies
// that check. Explicitly overriding "Output Directory" in the Vercel dashboard
// instead was tried and rejected: it silently disables api/ Functions
// auto-detection entirely, which is the opposite of what this project needs.
function writeOutputs(): Plugin {
  return {
    name: 'write-outputs',
    writeBundle() {
      fs.cpSync(
        path.join(__dirname, '../../libs/personal-data/src/data'),
        path.join(__dirname, 'api/data'),
        { recursive: true },
      );
      fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(__dirname, 'dist/.gitkeep'), '');
    },
  };
}

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/personal-mcp',
  plugins: [writeOutputs()],
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
