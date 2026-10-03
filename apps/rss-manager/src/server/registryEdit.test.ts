import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SOURCES_FIXTURE, TOPICS_FIXTURE } from './registry.fixtures.js';
import { parseSources, parseTopics } from './registry.js';
import {
  applySourceAction,
  applyTopicAction,
  editRegistryFile,
  editSources,
  editTopics,
} from './registryEdit.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: vi.fn(actual.writeFileSync),
    renameSync: vi.fn(actual.renameSync),
  };
});

const SOURCES = `${SOURCES_FIXTURE}
- [ ] **Old Feed** #domain/frontend <!-- stale: feed-dead | 404 since May -->
  https://old.example.com/feed.xml
`.replace(
  '- [x] **CSS-Tricks** #domain/frontend #tech/css',
  '- [x] **CSS-Tricks** #domain/frontend #tech/css <!-- stale: delivery-gap | nothing in Reader for 3 weeks -->',
);

const TOPICS = `${TOPICS_FIXTURE}
- [ ] **Crypto** #finance
  Declined as noise
`;

function statusOf(items: { name: string; status: string }[], name: string) {
  return items.find((item) => item.name === name)?.status;
}

function errno(code: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(`${code}: operation failed`);
  err.code = code;
  return err;
}

describe('applySourceAction', () => {
  it('activates a proposed source into Active Sources with its lines', () => {
    const text = applySourceAction(SOURCES, "TkDodo's Blog", 'activate');
    const active = text.slice(
      text.indexOf('## Active Sources'),
      text.indexOf('## Proposed Sources'),
    );

    expect(active).toContain(
      "- [x] **TkDodo's Blog** #tech/tanstack #tech/react\n  https://tkdodo.eu/blog/rss.xml",
    );
    expect(active).toContain('  **What**: Deep dives into React patterns.');
    expect(statusOf(parseSources(text), "TkDodo's Blog")).toBe('active');
    expect(parseSources(text)).toHaveLength(parseSources(SOURCES).length);
  });

  it('re-activates a retired source and keeps its stale comment', () => {
    const text = applySourceAction(SOURCES, 'Old Feed', 'activate');
    const source = parseSources(text).find((s) => s.name === 'Old Feed');

    expect(source?.status).toBe('active');
    expect(source?.stale).toEqual({ type: 'feed-dead', note: '404 since May' });
  });

  it('checks the box in place for an unchecked entry already under Active Sources', () => {
    const before = SOURCES.replace('- [x] **Astro**', '- [ ] **Astro**');
    expect(statusOf(parseSources(before), 'Astro')).toBe('proposed');

    const text = applySourceAction(before, 'Astro', 'activate');

    expect(text).toBe(SOURCES);
  });

  it.each(['Astro', "TkDodo's Blog", 'Claude Code Changelog'])(
    'retires %s into Retired, unchecked',
    (name) => {
      const text = applySourceAction(SOURCES, name, 'retire');
      const retired = text.slice(text.indexOf('## Retired'));

      expect(retired).toMatch(
        new RegExp(`^- \\[ \\] \\*\\*${name}\\*\\*`, 'm'),
      );
      expect(statusOf(parseSources(text), name)).toBe('retired');
    },
  );

  it('creates Retired when the file has none', () => {
    const before = SOURCES_FIXTURE.replace('\n## Retired\n', '\n');
    const text = applySourceAction(before, 'Astro', 'retire');

    expect(text).toContain('## Retired\n\n- [ ] **Astro**');
    expect(statusOf(parseSources(text), 'Astro')).toBe('retired');
  });

  it('throws on a name that is not there', () => {
    expect(() => applySourceAction(SOURCES, 'Nope', 'retire')).toThrow(
      'Entry not found: Nope',
    );
  });
});

describe('applyTopicAction', () => {
  it('activates a proposed topic', () => {
    const text = applyTopicAction(TOPICS, 'Home automation', 'activate');
    expect(statusOf(parseTopics(text), 'Home automation')).toBe('active');
    expect(text).toContain(
      '- [x] **Home automation** #devops\n  HA and smart home tools',
    );
  });

  it('re-activates a declined topic', () => {
    const text = applyTopicAction(TOPICS, 'Crypto', 'activate');
    expect(statusOf(parseTopics(text), 'Crypto')).toBe('active');
  });

  it('declines a proposed topic, unchecked', () => {
    const text = applyTopicAction(TOPICS, 'Home automation', 'decline');
    expect(statusOf(parseTopics(text), 'Home automation')).toBe('declined');
    expect(text).toContain('- [ ] **Home automation** #devops');
  });

  it('creates Declined when the file has none', () => {
    const before = TOPICS_FIXTURE.replace('\n## Declined\n', '\n');
    const text = applyTopicAction(before, 'Home automation', 'decline');
    expect(text).toContain('## Declined\n\n- [ ] **Home automation**');
  });
});

describe('editSources', () => {
  it('applies every name in one text', () => {
    const result = editSources(
      SOURCES,
      ["TkDodo's Blog", 'The GitHub Blog'],
      'activate',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applied).toEqual(["TkDodo's Blog", 'The GitHub Blog']);
    const sources = parseSources(result.text);
    expect(statusOf(sources, "TkDodo's Blog")).toBe('active');
    expect(statusOf(sources, 'The GitHub Blog')).toBe('active');
    expect(statusOf(sources, 'Claude Code Changelog')).toBe('no-rss');
  });

  it('applies a name sent twice once', () => {
    const result = editSources(SOURCES, ['Astro', 'Astro'], 'retire');
    expect(result).toMatchObject({ ok: true, applied: ['Astro'] });
  });

  it('rejects the whole batch when one name is unknown', () => {
    expect(editSources(SOURCES, ["TkDodo's Blog", 'Nope'], 'activate')).toEqual(
      {
        ok: false,
        rejected: [{ name: 'Nope', reason: 'not in the registry' }],
      },
    );
  });

  it.each([
    ['Astro', 'activate', 'cannot activate a source that is active'],
    [
      'Claude Code Changelog',
      'activate',
      'cannot activate a source that is no-rss',
    ],
    ['Old Feed', 'retire', 'already retired'],
    [
      'CSS-Tricks',
      'retire',
      'has a delivery gap; re-subscribe instead of retiring',
    ],
  ] as const)('rejects %s for %s', (name, action, reason) => {
    expect(editSources(SOURCES, ['The GitHub Blog', name], action)).toEqual({
      ok: false,
      rejected: [{ name, reason }],
    });
  });

  it('acts on the first entry when a name is duplicated', () => {
    const before = SOURCES.replace(
      '## No RSS Found',
      '- [ ] **Astro** #dup\n  https://dup.example.com/rss.xml\n\n## No RSS Found',
    );
    const result = editSources(before, ['Astro'], 'retire');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const astros = parseSources(result.text).filter((s) => s.name === 'Astro');
    expect(astros.map((s) => [s.status, s.url])).toEqual([
      ['proposed', 'https://dup.example.com/rss.xml'],
      ['retired', 'https://astro.build/rss.xml'],
    ]);
  });
});

describe('editTopics', () => {
  it('activates proposed and declined topics together', () => {
    const result = editTopics(
      TOPICS,
      ['Home automation', 'Crypto'],
      'activate',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      parseTopics(result.text).filter((t) => t.status === 'active'),
    ).toHaveLength(4);
  });

  it.each([
    ['AI agents & tools', 'decline', 'cannot decline a topic that is active'],
    ['Crypto', 'decline', 'cannot decline a topic that is declined'],
    ['AI agents & tools', 'activate', 'cannot activate a topic that is active'],
  ] as const)('rejects %s for %s', (name, action, reason) => {
    expect(editTopics(TOPICS, [name], action)).toEqual({
      ok: false,
      rejected: [{ name, reason }],
    });
  });
});

describe('editRegistryFile', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rss-manager-'));
    file = join(dir, 'RSS-Source-Registry.md');
    writeFileSync(file, SOURCES, 'utf-8');
    chmodSync(file, 0o640);
    vi.mocked(writeFileSync).mockClear();
    vi.mocked(renameSync).mockClear();
  });

  it('writes a batch once, through a temp file renamed over the original', () => {
    const result = editRegistryFile(file, (text) =>
      editSources(
        text,
        ["TkDodo's Blog", 'The GitHub Blog', 'Old Feed'],
        'activate',
      ),
    );

    expect(result.ok).toBe(true);
    const temp = join(dir, '.RSS-Source-Registry.md.tmp');
    expect(writeFileSync).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeFileSync).mock.calls[0][0]).toBe(temp);
    expect(renameSync).toHaveBeenCalledTimes(1);
    expect(renameSync).toHaveBeenCalledWith(temp, file);
    expect(readdirSync(dir)).toEqual(['RSS-Source-Registry.md']);
    expect(
      parseSources(readFileSync(file, 'utf-8')).filter(
        (s) => s.status === 'active',
      ),
    ).toHaveLength(6);
  });

  it('keeps the file mode', () => {
    editRegistryFile(file, (text) => editSources(text, ['Astro'], 'retire'));
    expect(statSync(file).mode & 0o777).toBe(0o640);
  });

  it('does not touch the file when the batch is rejected', () => {
    const result = editRegistryFile(file, (text) =>
      editSources(text, ["TkDodo's Blog", 'Nope'], 'activate'),
    );

    expect(result.ok).toBe(false);
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(renameSync).not.toHaveBeenCalled();
    expect(readFileSync(file, 'utf-8')).toBe(SOURCES);
  });

  it('leaves the original intact and no temp file when the rename fails', () => {
    vi.mocked(renameSync).mockImplementationOnce(() => {
      throw errno('EIO');
    });

    expect(() =>
      editRegistryFile(file, (text) => editSources(text, ['Astro'], 'retire')),
    ).toThrow('EIO');
    expect(readFileSync(file, 'utf-8')).toBe(SOURCES);
    expect(readdirSync(dir)).toEqual(['RSS-Source-Registry.md']);
  });

  it('leaves the original intact when the temp write dies halfway', async () => {
    const { writeFileSync: realWrite } =
      await vi.importActual<typeof import('node:fs')>('node:fs');
    vi.mocked(writeFileSync).mockImplementationOnce((path, data) => {
      realWrite(path, String(data).slice(0, 40));
      throw errno('ENOSPC');
    });

    expect(() =>
      editRegistryFile(file, (text) => editSources(text, ['Astro'], 'retire')),
    ).toThrow('ENOSPC');
    expect(readFileSync(file, 'utf-8')).toBe(SOURCES);
    expect(existsSync(join(dir, '.RSS-Source-Registry.md.tmp'))).toBe(false);
  });

  it.skipIf(process.getuid?.() === 0)(
    'refuses a read-only file even though the directory allows the rename',
    () => {
      chmodSync(file, 0o444);

      expect(() =>
        editRegistryFile(file, (text) =>
          editSources(text, ['Astro'], 'retire'),
        ),
      ).toThrow(expect.objectContaining({ code: 'EACCES' }));
      expect(renameSync).not.toHaveBeenCalled();
      expect(readFileSync(file, 'utf-8')).toBe(SOURCES);
    },
  );
});
