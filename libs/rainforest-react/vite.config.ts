import { copyFileSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
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

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/rainforest-react',
  plugins: [
    tailwindcss(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    {
      name: 'copy-tailwind-partial',
      apply: 'build',
      closeBundle() {
        copyFileSync(
          path.join(__dirname, 'src/tailwind.css'),
          path.join(__dirname, 'dist/tailwind.css'),
        );
      },
    },
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: false,
    cssCodeSplit: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        styles: 'src/styles.css',
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: (id) =>
        externals.some((dep) => id === dep || id.startsWith(`${dep}/`)),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        assetFileNames: (asset) =>
          asset.names.some((n) => n.endsWith('.css'))
            ? '[name][extname]'
            : 'assets/[name]-[hash][extname]',
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
      reportsDirectory: '../../coverage/libs/rainforest-react',
      provider: 'v8',
    },
  },
});
