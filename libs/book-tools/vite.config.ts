import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(
  readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
) as { dependencies: Record<string, string> };

// mcp-kit stays a separate module: its ToolInputError must be the class registerTools checks.
const externals = [
  ...Object.keys(pkg.dependencies),
  '@modelcontextprotocol/sdk',
];

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/book-tools',
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
      fileName: (format: string, entryName: string) =>
        `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    ssr: true,
    rolldownOptions: {
      external: (id) =>
        externals.some((dep) => id === dep || id.startsWith(`${dep}/`)),
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/book-tools',
      provider: 'v8',
    },
  },
});
