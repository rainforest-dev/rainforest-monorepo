import * as path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Serves the story gallery only. The library's own vite.config.ts builds the package and runs
// Vitest; neither needs Tailwind, so the gallery gets its own server.
export default defineConfig({
  root: path.join(import.meta.dirname, '..'),
  cacheDir: '../../node_modules/.vite/libs/library-shell-gallery',
  plugins: [tailwindcss()],
  // Crawl the stories at startup: a dependency first seen when a test imports a story makes
  // Vite re-optimize and reload, and that test's dynamic import fails.
  optimizeDeps: {
    entries: ['playwright/gallery/index.html', 'src/**/*.story.tsx'],
  },
  server: { port: 3100, strictPort: true },
});
