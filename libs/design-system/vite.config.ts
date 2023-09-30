/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/design-system',

  plugins: [
    nxViteTsPaths(),
    dts({
      entryRoot: 'src/lib',
      tsConfigFilePath: path.join(__dirname, 'tsconfig.lib.json'),
      skipDiagnostics: true,
    }),
  ],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  // Configuration for building your library.
  // See: https://vitejs.dev/guide/build.html#library-mode
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: {
        plugins: path.resolve(__dirname, 'src/lib/plugins/index.ts'),
        'components/lit': path.resolve(
          __dirname,
          'src/lib/components/lit/index.ts'
        ),
      },
      fileName: (format, entryName) => {
        // if entryName is not index,
        // transfer to index in folder named by entryName
        // format: es -> ejs
        // format: cjs -> js
        if (entryName !== 'index') {
          return format === 'es'
            ? `${entryName}/index.mjs`
            : `${entryName}/index.js`;
        }
        // if entryName is index,
        // return index in root folder
        return format === 'es' ? `index.mjs` : `index.js`;
      },
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: [],
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});
