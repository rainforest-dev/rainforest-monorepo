import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

const runTs = (expression) =>
  execFileSync(
    process.execPath,
    ['-r', '@swc-node/register', '-e', expression],
    {
      cwd: workspaceRoot,
      stdio: 'inherit',
    },
  );

const firstThumb = (dataDir) => {
  const { events } = JSON.parse(
    readFileSync(join(dataDir, 'timeline.json'), 'utf8'),
  );
  const event = events.find((e) =>
    e.media?.some((m) => /\.(png|jpe?g)$/i.test(m.path)),
  );
  if (!event) throw new Error('the memories fixture has no image');
  return `/thumb/${event.id}?w=240`;
};

const APPS = {
  'personal-memories': {
    kind: 'astro',
    root: 'apps/personal-memories',
    entry: 'dist/server/entry.mjs',
    port: 39104,
    prepare: (scratch) => {
      const data = join(scratch, 'data');
      const notes = join(scratch, 'notes');
      execFileSync(
        process.execPath,
        ['apps/personal-memories/src/cli/fixture.ts', data],
        {
          cwd: workspaceRoot,
          stdio: 'inherit',
        },
      );
      mkdirSync(notes);
      return {
        env: {
          MEMORIES_DATA_DIR: data,
          MEMORIES_NOTES_DIR: notes,
          MEMORIES_CACHE_DIR: join(scratch, 'cache'),
          MEMORIES_EMBED: 'fake',
        },
        checks: [
          { path: '/' },
          { path: '/days.json', type: 'application/json' },
          { path: firstThumb(data), type: 'image/webp' },
        ],
      };
    },
  },
  'rss-manager': {
    kind: 'astro',
    root: 'apps/rss-manager',
    entry: 'dist/server/entry.mjs',
    port: 39102,
    prepare: () => {
      runTs("require('./apps/rss-manager-e2e/src/support/vault').resetVault()");
      return {
        env: {
          VAULT_PATH: join(
            workspaceRoot,
            'apps/rss-manager-e2e/test-output/vault',
          ),
        },
        checks: [
          { path: '/' },
          { path: '/api/sources', type: 'application/json' },
        ],
      };
    },
  },
  'personal-calibre': {
    kind: 'next',
    root: 'apps/personal-calibre',
    entry: 'apps/personal-calibre/server.js',
    workdir: '.',
    port: 39180,
    prepare: () => {
      runTs(
        "require('./apps/personal-calibre-e2e/src/support/seed').seedFixtures('small')",
      );
      const fixtures = join(
        workspaceRoot,
        'apps/personal-calibre-e2e/test-output/fixtures',
      );
      return {
        env: {
          CALIBRE_LIBRARY_PATH: fixtures,
          CALIBRE_APP_DB_PATH: join(fixtures, 'app.db'),
        },
        checks: [
          { path: '/' },
          { path: '/books/1' },
          { path: '/api/books', type: 'application/json' },
        ],
      };
    },
  },
};

const name = process.argv[2];
const app = APPS[name];
if (!app) {
  console.error(
    `usage: node tools/app-artifact/smoke.mjs <${Object.keys(APPS).join('|')}>`,
  );
  process.exit(2);
}

const started = Date.now();
execFileSync(
  process.execPath,
  ['tools/app-artifact/bundle.mjs', app.kind, app.root],
  {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: { ...process.env, APP_ARTIFACT_PLATFORM: 'host' },
  },
);

const artifact = join(tmpdir(), 'app-artifacts-host', name);
const scratch = mkdtempSync(join(tmpdir(), `smoke-${name}-`));
const { env, checks } = app.prepare(scratch);
const base = `http://127.0.0.1:${app.port}`;

let log = '';
const server = spawn(process.execPath, [app.entry], {
  cwd: join(artifact, app.workdir ?? app.root),
  env: {
    PATH: process.env.PATH,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    HOSTNAME: '127.0.0.1',
    PORT: String(app.port),
    ...env,
  },
});
server.stdout.on('data', (chunk) => (log += chunk));
server.stderr.on('data', (chunk) => (log += chunk));
const exited = new Promise((done) => server.on('exit', (code) => done(code)));

const waitForServer = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) return false;
    try {
      await fetch(base, { redirect: 'manual' });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return false;
};

let failed = !(await waitForServer());
if (failed) console.log(`FAIL ${name} did not start on ${base}`);
for (const check of failed ? [] : checks) {
  const res = await fetch(base + check.path, { redirect: 'manual' });
  const type = res.headers.get('content-type') ?? '';
  const ok = res.status === 200 && (!check.type || type.startsWith(check.type));
  if (!ok) failed = true;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${res.status} ${type || '-'} ${check.path}`,
  );
}

server.kill('SIGTERM');
await exited;
rmSync(scratch, { recursive: true, force: true });
if (failed) console.log(`--- ${name} server output ---\n${log}`);
console.log(
  `${name}: smoke ${failed ? 'failed' : 'passed'} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
process.exit(failed ? 1 : 0);
