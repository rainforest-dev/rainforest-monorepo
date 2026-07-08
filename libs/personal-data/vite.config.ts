import * as path from 'path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/personal-data',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    lib: {
      // Two entry points, not one: `vocab` (skillTags/experienceTypes/locales) is pure
      // data, safe and minimal to bundle into browser/client code — the main `index`
      // entry re-exports it too, but also pulls in loader.ts/profile-data.ts, which
      // inline the entire content dataset (see loader.ts). apps/personal-website's
      // client-hydrated components (e.g. fab.vue) import tags only, via
      // `@rainforest-dev/personal-data/vocab`, to avoid dragging that dataset into
      // their client bundle.
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
    coverage: {
      reportsDirectory: '../../coverage/libs/personal-data',
      provider: 'v8',
    },
  },
});
