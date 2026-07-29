import * as fs from 'node:fs/promises';

import matter from 'gray-matter';
import * as path from 'path';
import type { Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

// Parses `*.md?frontmatter` imports with gray-matter in Node, at build time, instead of
// loader.ts calling `matter()` at runtime. gray-matter needs Node's `Buffer`, which browsers
// don't have, so runtime parsing throws `ReferenceError: Buffer is not defined` — invisible
// while this library only ran server-side (MCP endpoint, llms.txt, Astro SSR), but fatal now
// that the ⌘K command palette's on-device "ask" tools run this same loader client-side.
// Shipping the already-parsed `{ data, content }` as JSON is also strictly smaller than
// shipping raw markdown *plus* a YAML/frontmatter parser to run it through in the browser.
//
// Implemented as a `load` hook (not `transform`) because nothing else claims `.md?frontmatter`
// — mirrors how Vite's own built-in `?raw` handling works (`vite:asset`'s `load` hook reads the
// file itself and returns `export default ${JSON.stringify(text)}`; see
// node_modules/vite/dist/node/chunks/node.js's `assetPlugin`), so there's no upstream loader
// output to transform, only a file on disk to read and reshape.
function frontmatterPlugin(): Plugin {
  return {
    name: 'personal-data:frontmatter',
    enforce: 'pre',
    async load(id) {
      const [filePath, query] = id.split('?');
      if (!filePath.endsWith('.md') || !query) return;
      if (!new URLSearchParams(query).has('frontmatter')) return;
      this.addWatchFile(filePath);
      const raw = await fs.readFile(filePath, 'utf-8');
      const { data, content } = matter(raw);
      return `export default ${JSON.stringify({ data, content })};`;
    },
  };
}

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/personal-data',
  plugins: [
    frontmatterPlugin(),
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
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
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
