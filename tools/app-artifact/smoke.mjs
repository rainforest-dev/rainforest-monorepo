import { execFileSync, spawn } from 'node:child_process';
import { request } from 'node:http';
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
  'reading-room': {
    kind: 'astro',
    root: 'apps/reading-room',
    entry: 'dist/server/entry.mjs',
    port: 39102,
    prepare: () => {
      runTs(
        "require('./apps/reading-room-e2e/src/support/vault').resetVault()",
      );
      runTs(
        "require('./apps/reading-room-e2e/src/support/kb-vault').resetKbVault()",
      );
      const kb = join(workspaceRoot, 'apps/reading-room-e2e/test-output/kb');
      return {
        env: {
          VAULT_PATH: join(
            workspaceRoot,
            'apps/reading-room-e2e/test-output/vault',
          ),
          KB_WIKI_PATH: join(kb, 'wiki'),
          KB_READWISE_PATH: join(kb, 'readwise'),
          EVENTS_SOURCES: 'off',
        },
        checks: [
          { path: '/rack' },
          { path: '/rack/events' },
          { path: '/rack/api/events', type: 'application/json' },
          { path: '/rack/sources' },
          { path: '/rack/api/sources', type: 'application/json' },
          { path: '/rack/api/hall-items', type: 'application/json' },
          {
            path: '/rack/api/library-search?q=the',
            type: 'application/json',
          },
          // Astro trusts the Host header only for `security.allowedDomains`; without it every
          // page thought it was on localhost and dropped the links to the other collections.
          {
            path: '/rack',
            headers: { host: 'library.rainforest.tools' },
            contains: 'href="/books"',
          },
          {
            path: '/rack',
            headers: { host: 'rss.rainforest.tools' },
            status: 301,
            location: 'https://library.rainforest.tools/rack',
          },
          { path: '/kb' },
          { path: '/kb/pages/tech-kites' },
          { path: '/kb/api/hall-items', type: 'application/json' },
          { path: '/kb/api/library-search?q=kites', type: 'application/json' },
        ],
      };
    },
  },
  'personal-notebook': {
    kind: 'next',
    root: 'apps/personal-notebook',
    entry: 'apps/personal-notebook/server.js',
    workdir: '.',
    port: 39186,
    prepare: (scratch) => ({
      env: {
        NOTEBOOK_DATA_DIR: join(scratch, 'data'),
        NOTEBOOK_EMBED: 'fake',
      },
      checks: [
        { path: '/notebooks' },
        { path: '/notebooks/api/hall-items', type: 'application/json' },
        { path: '/notebooks/api/search?q=ink', type: 'application/json' },
        {
          path: '/notebooks/api/library-search?q=ink',
          type: 'application/json',
        },
        { path: '/notebooks/_shell/shell.css', type: 'text/css' },
      ],
    }),
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
          { path: '/books' },
          { path: '/books/books/1' },
          { path: '/books?view=study&groupBy=series' },
          { path: '/books/api/books', type: 'application/json' },
          { path: '/books/api/hall-items', type: 'application/json' },
          {
            path: '/books/api/library-search?q=the',
            type: 'application/json',
          },
          { path: '/books/_shell/shell.css', type: 'text/css' },
        ],
      };
    },
  },
  'library-hall': {
    kind: 'next',
    root: 'apps/library-hall',
    entry: 'apps/library-hall/server.js',
    workdir: '.',
    port: 39186,
    // No collection URLs: the shelves come back empty, which still boots the page and the
    // aggregating route from the artifact.
    prepare: () => ({
      env: {},
      checks: [
        { path: '/' },
        { path: '/api/items', type: 'application/json' },
        { path: '/api/search?q=the', type: 'application/json' },
      ],
    }),
  },
};

/**
 * One GET without following redirects. `fetch` drops a `Host` header, which the old and
 * library hostname checks need.
 */
const get = (url, headers = {}) =>
  new Promise((done, fail) => {
    const req = request(url, { headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () =>
        done({
          status: res.statusCode ?? 0,
          type: res.headers['content-type'] ?? '',
          location: res.headers.location ?? null,
          body,
        }),
      );
    });
    req.on('error', fail);
    req.end();
  });

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
  const res = await get(base + check.path, check.headers);
  const type = res.type;
  const ok =
    res.status === (check.status ?? 200) &&
    (!check.type || type.startsWith(check.type)) &&
    (!check.location || res.location === check.location) &&
    (!check.contains || res.body.includes(check.contains));
  if (!ok) failed = true;
  const host = check.headers?.host ? ` (Host: ${check.headers.host})` : '';
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${res.status} ${type || '-'} ${check.path}${host}`,
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
