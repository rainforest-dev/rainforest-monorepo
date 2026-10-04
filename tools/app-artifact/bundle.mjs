import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { IMAGE_TARGET, retargetNatives } from './natives.mjs';

const [kind, appRoot] = process.argv.slice(2);
if (!['astro', 'next'].includes(kind) || !appRoot) {
  console.error(
    'usage: node tools/app-artifact/bundle.mjs <astro|next> <app root>',
  );
  process.exit(2);
}

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const forHost = process.env['APP_ARTIFACT_PLATFORM'] === 'host';
const out = forHost
  ? join(tmpdir(), 'app-artifacts-host', basename(appRoot))
  : join(workspaceRoot, 'dist', 'artifacts', basename(appRoot));

const copyTraced = async () => {
  const require = createRequire(join(workspaceRoot, appRoot, 'package.json'));
  const { nodeFileTrace } = await import(
    pathToFileURL(require.resolve('@vercel/nft')).href
  );
  const { fileList } = await nodeFileTrace(
    [join(appRoot, 'dist', 'server', 'entry.mjs')],
    {
      base: workspaceRoot,
    },
  );
  const links = [];
  for (const file of [...fileList, join(appRoot, 'dist')]) {
    const from = join(workspaceRoot, file);
    if (lstatSync(from).isSymbolicLink()) {
      links.push(file);
      continue;
    }
    mkdirSync(dirname(join(out, file)), { recursive: true });
    cpSync(from, join(out, file), { recursive: true, verbatimSymlinks: true });
  }
  for (const file of links) {
    mkdirSync(dirname(join(out, file)), { recursive: true });
    symlinkSync(readlinkSync(join(workspaceRoot, file)), join(out, file));
  }
};

const copyStandalone = () => {
  const next = join(workspaceRoot, appRoot, '.next');
  if (!existsSync(join(next, 'standalone', appRoot, 'server.js'))) {
    throw new Error(
      `${appRoot}/.next/standalone/${appRoot}/server.js is missing`,
    );
  }
  cpSync(join(next, 'standalone'), out, {
    recursive: true,
    verbatimSymlinks: true,
  });
  cpSync(join(next, 'static'), join(out, appRoot, '.next', 'static'), {
    recursive: true,
  });
  cpSync(join(workspaceRoot, appRoot, 'public'), join(out, appRoot, 'public'), {
    recursive: true,
  });
};

const imageNodeMajor = () => {
  const dockerfile = readFileSync(
    join(workspaceRoot, appRoot, 'Dockerfile'),
    'utf8',
  );
  const match = /^FROM node:(\d+)/m.exec(dockerfile);
  if (!match)
    throw new Error(`${appRoot}/Dockerfile does not start FROM node:<major>`);
  return match[1];
};

rmSync(out, { recursive: true, force: true });
if (kind === 'astro') await copyTraced();
else copyStandalone();

if (!forHost)
  retargetNatives(out, IMAGE_TARGET, {
    workspaceRoot,
    nodeMajor: imageNodeMajor(),
  });

console.log(
  `${appRoot} → ${out} (${forHost ? `host ${process.platform}-${process.arch}` : 'linux-arm64-musl'})`,
);
