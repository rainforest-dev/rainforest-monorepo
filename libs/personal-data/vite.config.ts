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
      entry: { index: 'src/index.ts' },
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
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
