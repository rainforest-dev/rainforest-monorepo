import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  engineDrift,
  type EngineReport,
  readEngineReports,
} from './engineVersions.js';

let dir: string | null = null;
function usage(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), 'engines-'));
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(dir, name), body);
  return dir;
}
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

const report = (machine: string, version: string | null): EngineReport => ({
  machine,
  version,
  publishedAt: '2026-09-03T00:00:00Z',
});

describe('readEngineReports', () => {
  it('reads the version each machine published', () => {
    const d = usage({
      'projects.rainforest-mini.json': JSON.stringify({
        machine: 'rainforest-mini',
        published_at: '2026-09-03T01:00:00Z',
        engine_version: '2026.09.03-abc1234',
      }),
    });
    expect(readEngineReports(d)).toEqual([
      {
        machine: 'rainforest-mini',
        version: '2026.09.03-abc1234',
        publishedAt: '2026-09-03T01:00:00Z',
      },
    ]);
  });

  it('reports null rather than inventing a version for a host that predates the field', () => {
    const d = usage({
      'projects.rainforest-air.json': JSON.stringify({
        machine: 'rainforest-air',
        published_at: '2026-09-01T00:00:00Z',
      }),
    });
    expect(readEngineReports(d)[0].version).toBeNull();
  });

  it('lets one unreadable file hide nothing but itself', () => {
    const d = usage({
      'projects.a.json': '{ this is not json',
      'projects.b.json': JSON.stringify({ engine_version: '1' }),
    });
    expect(readEngineReports(d).map((r) => r.machine)).toEqual(['b']);
  });

  it('ignores files that are not a per-machine publication', () => {
    const d = usage({
      'tasks.json': JSON.stringify({ engine_version: 'nope' }),
      'projects.mini.json': JSON.stringify({ engine_version: '1' }),
    });
    expect(readEngineReports(d).map((r) => r.machine)).toEqual(['mini']);
  });

  it('returns nothing for a directory it cannot read', () => {
    expect(readEngineReports('/nonexistent/usage')).toEqual([]);
  });
});

describe('engineDrift', () => {
  it('says so plainly when both machines run the same release', () => {
    expect(engineDrift([report('air', '1.0'), report('mini', '1.0')])).toBe(
      'engines agree · 1.0',
    );
  });

  it('names both versions when they differ', () => {
    // The 2026-09-02 case: the Air was three releases behind and nothing said
    // so until someone sshed in and grepped a source file.
    expect(engineDrift([report('air', '1.0'), report('mini', '1.3')])).toBe(
      'engines differ · air 1.0 · mini 1.3',
    );
  });

  it('treats a silent machine as drift, not as agreement', () => {
    // Silence means that host predates the version being reported at all, which
    // is the same thing as being behind. Folding it into "agree" would hide the
    // very host most likely to be stale.
    const s = engineDrift([report('air', null), report('mini', '1.3')]);
    expect(s).toContain('air not reported');
    expect(s).not.toContain('agree');
  });

  it('says nobody has reported when no machine has', () => {
    const s = engineDrift([report('air', null), report('mini', null)]);
    expect(s).toContain('no machine reports an engine version');
  });

  it('has nothing to say when no machine has published at all', () => {
    expect(engineDrift([])).toBeNull();
  });
});
