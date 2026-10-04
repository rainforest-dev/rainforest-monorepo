import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseLineChat } from './line.ts';
import {
  applyLineMigration,
  archiveLineExport,
  collectLineUnits,
  type LineExportInput,
  type LineManifest,
  LineMigrationError,
  lineTimelineEvents,
  type LineUnit,
  newChatId,
  newestWinsChatEvents,
  planLineExport,
  planLineMigration,
  readLineManifest,
  sha256,
} from './line-archive.ts';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const exportText = (
  chatWith: string,
  savedOn: string | undefined,
  days: Record<string, [string, string][]>,
) =>
  [
    `[LINE] Chat history with ${chatWith}`,
    ...(savedOn ? [`Saved on: ${savedOn}`] : []),
    '',
    ...Object.entries(days).flatMap(([iso, messages]) => {
      const [y, m, d] = iso.split('-');
      const weekday = WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
      return [
        `${weekday}, ${m}/${d}/${y}`,
        ...messages.map(([author, text]) => `9:00AM\t${author}\t${text}`),
        '',
      ];
    }),
  ].join('\n');

const unit = (
  ...exports: { file: string; text: string; mtimeMs?: number }[]
): LineUnit => ({
  key: 'alice.txt',
  chat: 'alice',
  layout: 'chat',
  exports: exports.map((e) => ({ mtimeMs: 0, ...e })),
});

const days = (events: { at: string }[]) => [
  ...new Set(events.map((e) => e.at.slice(0, 10))),
];

describe('newestWinsChatEvents', () => {
  const OLD = exportText('Alice', '11/04/2025, 08:00', {
    '2025-11-01': [['Alice', 'one']],
    '2025-11-02': [['Alice', 'two (old)']],
    '2025-11-03': [['Bob', 'three (old)']],
  });

  it('takes overlapping dates from the newest export and earlier ones from the older', () => {
    const NEW = exportText('Alice', '11/06/2025, 08:00', {
      '2025-11-02': [['Alice', 'two (new)']],
      '2025-11-03': [['Bob', 'three (new)']],
      '2025-11-05': [['Bob', 'five']],
    });
    const { events, superseded } = newestWinsChatEvents(
      unit({ file: 'a.txt', text: NEW }, { file: 'b.txt', text: OLD }),
    );
    expect(events.map((e) => e.text)).toEqual([
      'one',
      'two (new)',
      'three (new)',
      'five',
    ]);
    expect(superseded).toBe(2);
    expect(events.every((e) => e.chat === 'alice')).toBe(true);
  });

  it('keeps older history when the newest export was cut short by a reinstall', () => {
    const TRUNCATED = exportText('Alice', '11/09/2025, 08:00', {
      '2025-11-08': [['Alice', 'after reinstall']],
    });
    const { events, superseded } = newestWinsChatEvents(
      unit({ file: 'a.txt', text: OLD }, { file: 'b.txt', text: TRUNCATED }),
    );
    expect(days(events)).toEqual([
      '2025-11-01',
      '2025-11-02',
      '2025-11-03',
      '2025-11-08',
    ]);
    expect(superseded).toBe(0);
  });

  it('does not show a day twice when the author was renamed between exports', () => {
    const RENAMED = exportText('Alice', '11/06/2025, 08:00', {
      '2025-11-02': [['Alice 🌷', 'two (old)']],
      '2025-11-03': [['Bob', 'three (old)']],
    });
    const { events } = newestWinsChatEvents(
      unit({ file: 'a.txt', text: OLD }, { file: 'b.txt', text: RENAMED }),
    );
    expect(events.map((e) => [e.author, e.text])).toEqual([
      ['Alice', 'one'],
      ['Alice 🌷', 'two (old)'],
      ['Bob', 'three (old)'],
    ]);
  });

  it('orders by the Saved on header, falling back to mtime', () => {
    const LATER = exportText('Alice', '12/01/2025, 08:00', {
      '2025-11-01': [['Alice', 'from the later save']],
    });
    const NO_HEADER = exportText('Alice', undefined, {
      '2025-11-01': [['Alice', 'from the newer file']],
    });
    const byHeader = newestWinsChatEvents(
      unit(
        { file: 'a.txt', text: LATER, mtimeMs: 0 },
        { file: 'b.txt', text: OLD, mtimeMs: Date.now() },
      ),
    );
    expect(byHeader.events.map((e) => e.text)).toEqual(['from the later save']);

    const byMtime = newestWinsChatEvents(
      unit(
        { file: 'a.txt', text: LATER, mtimeMs: 0 },
        { file: 'b.txt', text: NO_HEADER, mtimeMs: Date.UTC(2026, 0, 1) },
      ),
    );
    expect(byMtime.events.map((e) => e.text)).toEqual(['from the newer file']);
  });

  it('reads a legacy flat file exactly as the parser does, tagged with its stem', () => {
    const { events } = newestWinsChatEvents({
      key: 'alice.txt',
      chat: 'alice',
      layout: 'flat',
      exports: [{ file: 'alice.txt', text: OLD, mtimeMs: 0 }],
    });
    expect(events).toEqual(
      parseLineChat(OLD).events.map((e) => ({ ...e, chat: 'alice' })),
    );
  });
});

const input = (name: string, text: string): LineExportInput => ({
  name,
  bytes: Buffer.from(text),
  mtimeMs: Date.UTC(2025, 10, 10),
});

describe('planLineExport', () => {
  const ALICE = exportText('Alice', '11/04/2025, 08:00', {
    '2025-11-01': [['Alice', 'hi']],
  });
  const manifest = (
    ...entries: [string, string, string | undefined][]
  ): LineManifest => ({
    exports: Object.fromEntries(
      entries.map(([hash, chat, chatWith]) => [
        hash,
        { chat, chatWith, file: `${chat}/x.txt`, events: 1 },
      ]),
    ),
  });

  it('rejects files that are not English LINE exports with messages', () => {
    expect(planLineExport(input('a.zip', ALICE), manifest())).toMatchObject({
      kind: 'rejected',
      reason: 'not a .txt file',
    });
    expect(
      planLineExport(input('a.txt', '[LINE] 與Alice的聊天記錄\n'), manifest()),
    ).toMatchObject({ kind: 'rejected', reason: /header/ });
    expect(
      planLineExport(
        input('a.txt', '[LINE] Chat history with Alice\n'),
        manifest(),
      ),
    ).toMatchObject({ kind: 'rejected', reason: 'no messages' });
  });

  it('reports a byte-identical export as a duplicate', () => {
    expect(
      planLineExport(
        input('again.txt', ALICE),
        manifest([sha256(ALICE), 'alice', 'Alice']),
      ),
    ).toEqual({ kind: 'duplicate', hash: sha256(ALICE), chat: 'alice' });
  });

  it('files an export under the one chat whose header matches', () => {
    const plan = planLineExport(
      input('new.txt', ALICE),
      manifest(
        ['h1', 'alice', 'Alice'],
        ['h2', 'alice', 'Alice'],
        ['h3', 'carol', 'Carol'],
      ),
    );
    expect(plan).toMatchObject({
      kind: 'archive',
      chat: 'alice',
      newChat: false,
      entry: {
        file: `alice/2025-11-04-${sha256(ALICE).slice(0, 8)}.txt`,
        chatWith: 'Alice',
        savedOn: '2025-11-04T08:00:00+08:00',
        events: 1,
        first: '2025-11-01',
        last: '2025-11-01',
      },
    });
  });

  it('starts a new chat id from the header when nothing matches', () => {
    expect(planLineExport(input('new.txt', ALICE), manifest())).toMatchObject({
      kind: 'archive',
      chat: newChatId('Alice'),
      newChat: true,
    });
    expect(newChatId('Alice')).toMatch(/^chat-[0-9a-f]{8}$/);
  });

  it('rejects an export whose header matches several chats', () => {
    expect(
      planLineExport(
        input('new.txt', ALICE),
        manifest(['h1', 'alice', 'Alice'], ['h2', 'alice-2024', 'Alice']),
      ),
    ).toEqual({ kind: 'rejected', reason: 'header matches 2 chats' });
  });
});

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'memories-line-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('archiveLineExport', () => {
  it('writes the export into its chat folder and the manifest, once', () => {
    const lineDir = join(root, 'line');
    const text = exportText('Carol', '11/04/2025, 08:00', {
      '2025-11-01': [['Carol', 'hey']],
    });
    const first = archiveLineExport(lineDir, input('export.txt', text));
    expect(first.kind).toBe('archive');
    const chat = newChatId('Carol');
    const [file] = readdirSync(join(lineDir, chat));
    expect(readFileSync(join(lineDir, chat, file ?? ''), 'utf8')).toBe(text);
    expect(Object.keys(readLineManifest(lineDir).exports)).toEqual([
      sha256(text),
    ]);
    expect(readdirSync(lineDir).some((f) => f.endsWith('.tmp'))).toBe(false);

    expect(archiveLineExport(lineDir, input('copy.txt', text)).kind).toBe(
      'duplicate',
    );
    expect(readdirSync(join(lineDir, chat))).toHaveLength(1);
  });
});

describe('line migration', () => {
  const SHARED = '9:00AM\tsystem\tYou unsent a message.';
  const flat = (name: string, text: string) =>
    writeFileSync(join(root, 'line', name), text);

  beforeEach(() => {
    mkdirSync(join(root, 'line'));
    flat(
      'a.txt',
      `${exportText('Alice', '11/04/2025, 08:00', { '2025-11-01': [['Alice', 'hi']] })}\n`.replace(
        '9:00AM\tAlice\thi',
        `9:00AM\tAlice\thi\n${SHARED}`,
      ),
    );
    flat(
      'a-b.txt',
      `${exportText('Alice', undefined, { '2025-11-01': [['Bob', 'yo']] })}`.replace(
        '9:00AM\tBob\tyo',
        `9:00AM\tBob\tyo\n${SHARED}`,
      ),
    );
    flat(
      'c.txt',
      exportText('Carol', '11/05/2025, 09:30', {
        '2025-11-02': [['Carol', 'hey']],
      }),
    );
  });

  it('moves each flat file into a folder named by its stem and keeps every id and chat', () => {
    const before = lineTimelineEvents(join(root, 'line'));
    expect(before.some((e) => e.id.endsWith('-2'))).toBe(true);

    const plan = planLineMigration(join(root, 'line'));
    expect(plan.moves.map((m) => m.to)).toEqual([
      expect.stringMatching(/^a-b\/\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.txt$/),
      expect.stringMatching(/^a\/2025-11-04-[0-9a-f]{8}\.txt$/),
      expect.stringMatching(/^c\/2025-11-05-[0-9a-f]{8}\.txt$/),
    ]);
    expect(plan.sharedHeaders).toBe(1);
    applyLineMigration(join(root, 'line'), plan);

    expect(
      collectLineUnits(join(root, 'line')).map((u) => [u.chat, u.layout]),
    ).toEqual([
      ['a-b', 'chat'],
      ['a', 'chat'],
      ['c', 'chat'],
    ]);
    expect(lineTimelineEvents(join(root, 'line'))).toEqual(before);
    expect(
      Object.values(readLineManifest(join(root, 'line')).exports).map(
        (e) => e.chat,
      ),
    ).toEqual(['a-b', 'a', 'c']);
    expect(planLineMigration(join(root, 'line')).moves).toEqual([]);
  });

  it('rolls everything back when the moved files would read differently', () => {
    const plan = planLineMigration(join(root, 'line'));
    const [first] = plan.moves;
    if (!first) throw new Error('no moves planned');
    first.to = first.to.replace(/^a-b\//, 'renamed/');
    first.entry.chat = 'renamed';

    expect(() => applyLineMigration(join(root, 'line'), plan)).toThrow(
      LineMigrationError,
    );
    expect(readdirSync(join(root, 'line')).sort()).toEqual([
      'a-b.txt',
      'a.txt',
      'c.txt',
    ]);
  });

  it('leaves a flat file in place when a chat folder of that name exists', () => {
    mkdirSync(join(root, 'line', 'c'));
    const plan = planLineMigration(join(root, 'line'));
    expect(plan.keptFlat).toEqual(['c.txt']);
    expect(existsSync(join(root, 'line', 'c.txt'))).toBe(true);
  });
});
