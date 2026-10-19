import { copyFileSync, cpSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(
  readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
) as {
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
};

const externals = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
];

// Consumers' Tailwind scans dist through tailwind.css; the view-transition rule is opt-in.
const CSS_FILES = ['tailwind.css', 'view-transitions.css'];

// The /_shell tree apps serve as-is: the stylesheet and icons from src, the Inter files from
// @fontsource so the version is pinned by the lockfile.
const INTER_FILES = [
  'inter-latin-wght-normal.woff2',
  'inter-latin-ext-wght-normal.woff2',
];
const interDir = path.join(
  path.dirname(
    createRequire(__filename).resolve(
      '@fontsource-variable/inter/package.json',
    ),
  ),
  'files',
);

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/library-shell',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    {
      name: 'copy-css',
      apply: 'build',
      closeBundle() {
        for (const file of CSS_FILES)
          copyFileSync(
            path.join(__dirname, 'src', file),
            path.join(__dirname, 'dist', file),
          );
        const shell = path.join(__dirname, 'dist/_shell');
        cpSync(path.join(__dirname, 'src/_shell'), shell, { recursive: true });
        mkdirSync(path.join(shell, 'fonts'), { recursive: true });
        for (const file of INTER_FILES)
          copyFileSync(
            path.join(interDir, file),
            path.join(shell, 'fonts', file),
          );
      },
    },
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: false,
    lib: {
      entry: { index: 'src/index.ts' },
      formats: ['es'],
    },
    rolldownOptions: {
      external: (id) =>
        externals.some((dep) => id === dep || id.startsWith(`${dep}/`)),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    // Node 25+ ships a global localStorage that shadows jsdom's and is undefined without --localstorage-file.
    execArgv: ['--no-experimental-webstorage'],
    include: ['src/**/*.test.{ts,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/library-shell',
      provider: 'v8',
    },
  },
});
