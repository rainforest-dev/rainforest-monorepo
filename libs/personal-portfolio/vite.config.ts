import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/personal-portfolio',
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    // Node 25+ ships a global localStorage that shadows jsdom's and is undefined without --localstorage-file.
    execArgv: ['--no-experimental-webstorage'],
    include: ['src/**/*.test.{ts,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/personal-portfolio',
      provider: 'v8',
    },
  },
});
