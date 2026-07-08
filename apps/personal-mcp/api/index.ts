import app from '../src/index';

// Explicit Vercel Function entrypoint (the "Fetch Web Standard Export" convention,
// per https://vercel.com/docs/functions/quickstart), placed under api/ deliberately
// instead of relying on Vercel's "Hono" framework auto-detection at src/index.ts.
// That auto-detected path built successfully but crashed at runtime with a raw
// Node module-loading SyntaxError ("Unexpected token 'const'") that couldn't be
// reproduced or diagnosed locally — whatever Vercel's Hono-specific bundler was
// doing with this monorepo's package structure, it produced broken output. The
// api/ convention is compiled directly by @vercel/node's own esbuild-based
// bundler — no Nx build step, no framework-specific magic, and no dependency on
// our tsconfig chain — so it sidesteps that whole class of problem entirely.
export default { fetch: app.fetch };
