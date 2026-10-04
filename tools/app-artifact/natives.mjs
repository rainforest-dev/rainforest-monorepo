import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

export const IMAGE_TARGET = { os: 'linux', cpu: 'arm64', libc: 'musl' };

const ELF_MACHINE = { arm64: 183, x64: 62 };
const NATIVE_FILE = /\.(node|dylib|dll)$|\.so(\.\d+)*$/;

const pnpmPackages = (out, name) => {
  const store = join(out, 'node_modules', '.pnpm');
  let entries = [];
  try {
    entries = readdirSync(store);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.startsWith(`${name.replace('/', '+')}@`))
    .map((entry) => join(store, entry, 'node_modules', name));
};

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const unpack = (spec, dest) => {
  const scratch = mkdtempSync(join(tmpdir(), 'app-artifact-'));
  try {
    const [{ filename }] = JSON.parse(
      execFileSync(
        'npm',
        ['pack', spec, '--json', '--silent', '--pack-destination', scratch],
        { encoding: 'utf8' },
      ),
    );
    mkdirSync(dest, { recursive: true });
    execFileSync('tar', [
      '-xzf',
      join(scratch, filename),
      '-C',
      dest,
      '--strip-components=1',
    ]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

const retargetSharp = (out, target) => {
  const platform = `${target.os}${target.libc === 'musl' ? 'musl' : ''}-${target.cpu}`;
  let retargeted = false;
  for (const dir of pnpmPackages(out, 'sharp')) {
    const imgDir = join(dir, '..', '@img');
    if (!existsSync(imgDir)) continue;
    const { optionalDependencies = {} } = readJson(join(dir, 'package.json'));
    for (const entry of readdirSync(imgDir)) {
      if (entry.startsWith('sharp-'))
        rmSync(join(imgDir, entry), { recursive: true });
    }
    for (const name of [
      `@img/sharp-${platform}`,
      `@img/sharp-libvips-${platform}`,
    ]) {
      const version = optionalDependencies[name];
      if (!version)
        throw new Error(`${relative(out, dir)} has no prebuilt ${name}`);
      unpack(`${name}@${version}`, join(dir, '..', name));
    }
    retargeted = true;
  }
  if (!retargeted) return;
  const store = join(out, 'node_modules', '.pnpm');
  for (const entry of readdirSync(store)) {
    if (entry.startsWith('@img+sharp-'))
      rmSync(join(store, entry), { recursive: true });
  }
};

const retargetBetterSqlite3 = (out, target, { workspaceRoot, nodeMajor }) => {
  for (const dir of pnpmPackages(out, 'better-sqlite3')) {
    const source = join(workspaceRoot, relative(out, dir));
    const bin = createRequire(join(source, 'package.json')).resolve(
      'prebuild-install/bin.js',
    );
    rmSync(join(dir, 'build'), { recursive: true, force: true });
    execFileSync(
      process.execPath,
      [
        bin,
        '--platform',
        target.os,
        '--arch',
        target.cpu,
        '--libc',
        target.libc,
        '--runtime',
        'node',
        '--target',
        `${nodeMajor}.0.0`,
      ],
      { cwd: dir, stdio: 'inherit' },
    );
    if (!existsSync(join(dir, 'build', 'Release', 'better_sqlite3.node'))) {
      throw new Error(
        `prebuild-install left no binary in ${relative(out, dir)}`,
      );
    }
  }
};

const nativeFiles = (dir, found = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) nativeFiles(path, found);
    else if (entry.isFile() && NATIVE_FILE.test(entry.name)) found.push(path);
  }
  return found;
};

const header = (file) => {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(20);
    readSync(fd, buf, 0, 20, 0);
    return buf;
  } finally {
    closeSync(fd);
  }
};

const mismatch = (file, target) => {
  const head = header(file);
  if (head.readUInt32BE(0) !== 0x7f454c46) return 'not an ELF file';
  if (head.readUInt16LE(18) !== ELF_MACHINE[target.cpu])
    return `not ${target.cpu}`;
  if (target.libc === 'musl' && readFileSync(file).includes('libc.so.6'))
    return 'linked against glibc';
  return undefined;
};

export const retargetNatives = (out, target, context) => {
  retargetSharp(out, target);
  retargetBetterSqlite3(out, target, context);
  const wrong = nativeFiles(out)
    .map((file) => [relative(out, file), mismatch(file, target)])
    .filter(([, reason]) => reason);
  if (wrong.length > 0) {
    const list = wrong
      .map(([file, reason]) => `  ${file}: ${reason}`)
      .join('\n');
    throw new Error(
      `native binaries that will not load on ${target.os}-${target.cpu}-${target.libc}:\n${list}\n` +
        'Teach tools/app-artifact/natives.mjs to fetch this package for the image platform.',
    );
  }
};
