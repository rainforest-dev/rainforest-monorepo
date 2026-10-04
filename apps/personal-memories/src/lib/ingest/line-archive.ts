import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { extname, join } from 'node:path';

// Relative, not @/: src/cli runs under plain `node`, which does not read tsconfig paths.
import {
  mergeTimelines,
  type TimelineEvent,
  toTaipeiIso,
} from '../server/timeline.ts';
import { type LineChat, parseLineChat } from './line.ts';

export type LineExport = { file: string; text: string; mtimeMs: number };

export type LineUnit = {
  key: string;
  chat: string;
  layout: 'flat' | 'chat';
  exports: LineExport[];
};

export type ManifestEntry = {
  chat: string;
  chatWith?: string;
  file: string;
  savedOn?: string;
  events: number;
  first?: string;
  last?: string;
};

export type LineManifest = { exports: Record<string, ManifestEntry> };

export const MANIFEST_FILE = 'manifest.json';

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const dateOf = (event: TimelineEvent) => event.at.slice(0, 10);

export const sha256 = (data: string | Buffer) =>
  createHash('sha256').update(data).digest('hex');

const txtFiles = (dir: string) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
    .map((entry) => entry.name)
    .sort(byCodeUnit);

const readExport = (dir: string, file: string): LineExport => {
  const path = join(dir, file);
  return {
    file,
    text: readFileSync(path, 'utf8'),
    mtimeMs: statSync(path).mtimeMs,
  };
};

export function collectLineUnits(lineDir: string): LineUnit[] {
  if (!existsSync(lineDir)) return [];
  const units: LineUnit[] = [];
  for (const entry of readdirSync(lineDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.txt')) {
      units.push({
        key: entry.name,
        chat: entry.name.replace(/\.txt$/, ''),
        layout: 'flat',
        exports: [readExport(lineDir, entry.name)],
      });
    } else if (entry.isDirectory()) {
      const dir = join(lineDir, entry.name);
      const files = txtFiles(dir);
      if (!files.length) continue;
      units.push({
        key: `${entry.name}.txt`,
        chat: entry.name,
        layout: 'chat',
        exports: files.map((file) => readExport(dir, file)),
      });
    }
  }
  // Ordered by `<chat>.txt`, the flat-file order, so mergeTimelines suffixes duplicates the same way after a move.
  return units.sort(
    (a, b) =>
      byCodeUnit(a.key, b.key) ||
      (a.layout === b.layout ? 0 : a.layout === 'flat' ? -1 : 1),
  );
}

export type ChatEvents = {
  events: TimelineEvent[];
  superseded: number;
};

export function newestWinsChatEvents(unit: LineUnit): ChatEvents {
  const parsed = unit.exports.map((exp) => ({
    exp,
    chat: parseLineChat(exp.text),
  }));
  const savedAt = ({ exp, chat }: { exp: LineExport; chat: LineChat }) =>
    chat.savedOn ?? toTaipeiIso(exp.mtimeMs);
  parsed.sort(
    (a, b) =>
      byCodeUnit(savedAt(b), savedAt(a)) || byCodeUnit(b.exp.file, a.exp.file),
  );

  const segments: TimelineEvent[][] = [];
  let floor: string | undefined;
  let superseded = 0;
  for (const { chat } of parsed) {
    const kept =
      floor === undefined
        ? chat.events
        : chat.events.filter((event) => dateOf(event) < (floor as string));
    superseded += chat.events.length - kept.length;
    const first = chat.events[0];
    if (first && (floor === undefined || dateOf(first) < floor))
      floor = dateOf(first);
    segments.unshift(kept);
  }
  return {
    events: segments.flat().map((event) => ({ ...event, chat: unit.chat })),
    superseded,
  };
}

export function readLineManifest(lineDir: string): LineManifest {
  const path = join(lineDir, MANIFEST_FILE);
  if (!existsSync(path)) return { exports: {} };
  const file = JSON.parse(readFileSync(path, 'utf8')) as Partial<LineManifest>;
  return { exports: file.exports ?? {} };
}

const writeAtomic = (path: string, data: string | Buffer) => {
  writeFileSync(`${path}.tmp`, data);
  renameSync(`${path}.tmp`, path);
};

export const writeLineManifest = (lineDir: string, manifest: LineManifest) =>
  writeAtomic(
    join(lineDir, MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

const archiveName = (chat: LineChat, mtimeMs: number, hash: string) =>
  `${(chat.savedOn ?? toTaipeiIso(mtimeMs)).slice(0, 10)}-${hash.slice(0, 8)}.txt`;

const entryFor = (
  chatId: string,
  file: string,
  chat: LineChat,
): ManifestEntry => {
  const entry: ManifestEntry = {
    chat: chatId,
    file,
    events: chat.events.length,
  };
  if (chat.chatWith !== undefined) entry.chatWith = chat.chatWith;
  if (chat.savedOn) entry.savedOn = chat.savedOn;
  const first = chat.events[0];
  const last = chat.events.at(-1);
  if (first) entry.first = dateOf(first);
  if (last) entry.last = dateOf(last);
  return entry;
};

export type LineExportInput = { name: string; bytes: Buffer; mtimeMs: number };

export type LineExportPlan =
  | { kind: 'rejected'; reason: string }
  | { kind: 'duplicate'; hash: string; chat: string }
  | {
      kind: 'archive';
      hash: string;
      chat: string;
      newChat: boolean;
      entry: ManifestEntry;
    };

export const newChatId = (chatWith: string) =>
  `chat-${sha256(chatWith).slice(0, 8)}`;

export function planLineExport(
  input: LineExportInput,
  manifest: LineManifest,
): LineExportPlan {
  if (extname(input.name).toLowerCase() !== '.txt')
    return { kind: 'rejected', reason: 'not a .txt file' };
  const chat = parseLineChat(input.bytes.toString('utf8'));
  if (chat.chatWith === undefined)
    return {
      kind: 'rejected',
      reason: 'no "[LINE] Chat history with" header',
    };
  if (!chat.events.length) return { kind: 'rejected', reason: 'no messages' };

  const hash = sha256(input.bytes);
  const known = manifest.exports[hash];
  if (known) return { kind: 'duplicate', hash, chat: known.chat };

  const matches = [
    ...new Set(
      Object.values(manifest.exports)
        .filter((entry) => entry.chatWith === chat.chatWith)
        .map((entry) => entry.chat),
    ),
  ];
  if (matches.length > 1)
    return {
      kind: 'rejected',
      reason: `header matches ${matches.length} chats`,
    };
  const chatId = matches[0] ?? newChatId(chat.chatWith);
  return {
    kind: 'archive',
    hash,
    chat: chatId,
    newChat: matches.length === 0,
    entry: entryFor(
      chatId,
      `${chatId}/${archiveName(chat, input.mtimeMs, hash)}`,
      chat,
    ),
  };
}

export function archiveLineExport(
  lineDir: string,
  input: LineExportInput,
): LineExportPlan {
  mkdirSync(lineDir, { recursive: true });
  const manifest = readLineManifest(lineDir);
  const plan = planLineExport(input, manifest);
  if (plan.kind !== 'archive') return plan;
  mkdirSync(join(lineDir, plan.chat), { recursive: true });
  writeAtomic(join(lineDir, plan.entry.file), input.bytes);
  manifest.exports[plan.hash] = plan.entry;
  writeLineManifest(lineDir, manifest);
  return plan;
}

export type LineMove = {
  from: string;
  to: string;
  hash: string;
  entry: ManifestEntry;
};

export type LineMigrationPlan = {
  moves: LineMove[];
  keptFlat: string[];
  sharedHeaders: number;
};

export function planLineMigration(lineDir: string): LineMigrationPlan {
  const plan: LineMigrationPlan = { moves: [], keptFlat: [], sharedHeaders: 0 };
  if (!existsSync(lineDir)) return plan;
  const headers = new Map<string, Set<string>>();
  for (const name of txtFiles(lineDir)) {
    const stem = name.replace(/\.txt$/, '');
    if (existsSync(join(lineDir, stem))) {
      plan.keptFlat.push(name);
      continue;
    }
    const exp = readExport(lineDir, name);
    const chat = parseLineChat(exp.text);
    const hash = sha256(readFileSync(join(lineDir, name)));
    const to = `${stem}/${archiveName(chat, exp.mtimeMs, hash)}`;
    plan.moves.push({ from: name, to, hash, entry: entryFor(stem, to, chat) });
    if (chat.chatWith !== undefined)
      headers.set(
        chat.chatWith,
        (headers.get(chat.chatWith) ?? new Set()).add(stem),
      );
  }
  plan.sharedHeaders = [...headers.values()].filter((s) => s.size > 1).length;
  return plan;
}

export const lineTimelineEvents = (lineDir: string) =>
  mergeTimelines(
    ...collectLineUnits(lineDir).map((u) => newestWinsChatEvents(u).events),
  );

export class LineMigrationError extends Error {}

export function applyLineMigration(
  lineDir: string,
  plan: LineMigrationPlan,
): void {
  if (!plan.moves.length) return;
  const before = JSON.stringify(lineTimelineEvents(lineDir));
  const manifestPath = join(lineDir, MANIFEST_FILE);
  const previousManifest = existsSync(manifestPath)
    ? readFileSync(manifestPath)
    : undefined;
  const done: LineMove[] = [];

  const rollback = () => {
    for (const move of done.reverse()) {
      renameSync(join(lineDir, move.to), join(lineDir, move.from));
      rmdirSync(join(lineDir, move.entry.chat));
    }
    if (previousManifest) writeAtomic(manifestPath, previousManifest);
    else rmSync(manifestPath, { force: true });
  };

  try {
    const manifest = readLineManifest(lineDir);
    for (const move of plan.moves) {
      const dir = join(lineDir, move.entry.chat);
      mkdirSync(dir);
      try {
        renameSync(join(lineDir, move.from), join(lineDir, move.to));
      } catch (error) {
        rmdirSync(dir);
        throw error;
      }
      done.push(move);
      manifest.exports[move.hash] ??= move.entry;
    }
    writeLineManifest(lineDir, manifest);
  } catch (error) {
    rollback();
    throw error;
  }

  if (JSON.stringify(lineTimelineEvents(lineDir)) !== before) {
    rollback();
    throw new LineMigrationError(
      'line: moving legacy exports would change event ids; rolled back',
    );
  }
}
