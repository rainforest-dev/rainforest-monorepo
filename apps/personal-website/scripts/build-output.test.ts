import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { scanOutput } from './output-scan.ts';

const OUTPUTS = ['dist', '.vercel/output'].map((dir) =>
  resolve(import.meta.dirname, '..', dir),
);

describe('build output', () => {
  let fixture: string | undefined;
  const makeFixture = (files: Record<string, string>) => {
    fixture = mkdtempSync(join(tmpdir(), 'output-scan-'));
    for (const [name, text] of Object.entries(files)) {
      const path = join(fixture, name);
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, text);
    }
    return fixture;
  };
  afterEach(() => {
    if (fixture) rmSync(fixture, { recursive: true, force: true });
    fixture = undefined;
  });

  it('flags a chunk that reaches a local Ollama', () => {
    const dir = makeFixture({
      'client/_astro/chunk.js': 'fetch("http://localhost:11434/api/tags")',
    });
    expect(scanOutput(dir)).toContainEqual(
      expect.objectContaining({
        file: join('client', '_astro', 'chunk.js'),
        pattern: 'ollama port',
      }),
    );
  });

  it.each([
    ['ollama embed route', 'u+"/api/embed"'],
    ['ollama chat route', 'u+"/api/chat"'],
    ['tailnet host', 'https://box.tail0000.ts.net'],
    ['mDNS host', 'http://nas.local/'],
    ['mDNS host', '{"host":"nas.local"}'],
    ['RFC 1918 10/8', 'http://10.0.0.2'],
    ['RFC 1918 172.16/12', 'http://172.20.1.1'],
    ['RFC 1918 192.168/16', 'http://192.168.1.10'],
  ])('flags %s', (pattern, text) => {
    const dir = makeFixture({ 'index.html': text });
    expect(scanOutput(dir).map((hit) => hit.pattern)).toEqual([pattern]);
  });

  it('passes output that names only public hosts', () => {
    const dir = makeFixture({
      'index.html': '<a href="https://rainforest.tools/api/mcp">mcp</a>',
      'chunk.js': 'localStorage.getItem("x");r=e.local?a:b;v="1.10.2"',
    });
    expect(scanOutput(dir)).toEqual([]);
  });

  it.each(OUTPUTS)('%s names no private host', (dir) => {
    expect(existsSync(dir), `${dir} is missing; build first`).toBe(true);
    expect(scanOutput(dir)).toEqual([]);
  });
});
