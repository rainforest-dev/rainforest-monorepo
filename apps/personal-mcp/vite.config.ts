import { defineConfig } from 'vite';

// Vercel's own bundler for api/*.ts is broken for this monorepo (traces/bundles
// the whole pnpm workspace and produces a corrupted function — see the design doc
// for the investigation). The fix is to ship it an already-fully-bundled,
// self-contained JS file instead, so it has nothing left to trace.
//
// This only builds to dist/ — copying the result into api/ (where Vercel's
// Functions convention actually reads from) happens in a separate
// scripts/copy-outputs.mjs step, chained after this one in the Nx build target.
// It isn't a Rollup/Rolldown plugin hook (closeBundle/writeBundle) because that
// output is unrelated to this build's own bundle — Vercel's api/ folder
// convention is a static Functions-detection scan of a specific path, not
// something Vite has any role in.
//
// dist/ (not building straight into api/) also matters on its own: Vercel's
// `vercel build` CLI has a separate, simplistic Nx-detection layer that needs a
// real dist/index.js to keep api/ Functions auto-detection active — an empty
// dist/.gitkeep placeholder wasn't enough, and explicitly overriding "Output
// Directory" to bypass the check disabled api/ detection outright.
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/personal-mcp',
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
