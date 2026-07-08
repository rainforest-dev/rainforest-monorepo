import * as fs from 'fs';
import * as path from 'path';
import dts from 'vite-plugin-dts';
import { defineConfig, type Plugin } from 'vitest/config';

// loader.ts resolves content files relative to its own module location at runtime
// (see loader.ts), so the built package needs its own copy of the data files next to
// the bundled index.{js,cjs} — `src/data` isn't part of the built output otherwise,
// and this package's `files` field only ships `dist` to consumers.
function copyDataDir(): Plugin {
  return {
    name: 'copy-data-dir',
    closeBundle() {
      fs.cpSync(path.join(__dirname, 'src/data'), path.join(__dirname, 'dist/data'), {
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/personal-data',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    copyDataDir(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    lib: {
      // Two entry points, not one: `vocab` (skillTags/experienceTypes/locales) is pure
      // data with zero Node dependencies, safe to bundle into browser/client code — the
      // main `index` entry re-exports it too, but also pulls in loader.ts/profile-data.ts,
      // which depend on node:fs/node:path/node:url and cannot be bundled for a browser
      // target. apps/personal-website's client-hydrated components (e.g. fab.vue) import
      // tags only, via `@rainforest-dev/personal-data/vocab`, to avoid dragging the
      // Node-only data-access layer into their client bundle.
      entry: { index: 'src/index.ts', vocab: 'src/vocab.ts' },
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    ssr: true,
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
    // loader.test.ts's validation-error case writes a temporary invalid fixture
    // directly into the shared src/data/organizations/en/ directory (and removes
    // it in afterEach). Running test files in parallel (vitest's default) lets
    // other files that also read the organizations collection (e.g.
    // profile-data.test.ts) observe that fixture mid-flight and fail on its
    // invalid locale. Running files sequentially avoids that cross-file race.
    fileParallelism: false,
    coverage: {
      reportsDirectory: '../../coverage/libs/personal-data',
      provider: 'v8',
    },
  },
});
