import palette from '@/styles/inside-out-palette.json';

export const EMOTIONS = [
  { id: 'joy', label: '開心', color: 'var(--io-joy)' },
  { id: 'sad', label: '難過', color: 'var(--io-sad)' },
  { id: 'anger', label: '生氣', color: 'var(--io-anger)' },
  { id: 'fear', label: '害怕', color: 'var(--io-fear)' },
  { id: 'disgust', label: '嫌棄', color: 'var(--io-disgust)' },
  { id: 'anxiety', label: '焦慮', color: 'var(--io-anxiety)' },
] as const;

export const ISLANDS = [
  { id: 'raindeer', label: 'RainDeer 島', glyph: '🦌' },
  { id: 'banbi', label: '伴比島', glyph: '🧸' },
  { id: 'travel', label: '旅行島', glyph: '✈️' },
  { id: 'home', label: '家島', glyph: '🏠' },
] as const;

export type EmotionId = (typeof EMOTIONS)[number]['id'];
export type IslandId = (typeof ISLANDS)[number]['id'];

export const EMOTION_IDS = EMOTIONS.map((e) => e.id) as [
  EmotionId,
  ...EmotionId[],
];
export const ISLAND_IDS = ISLANDS.map((i) => i.id) as [IslandId, ...IslandId[]];

export const PERSON_COLORS = [
  'var(--io-person-1)',
  'var(--io-person-2)',
] as const;
export const EMPTY_HALF = 'var(--io-empty)';
export const CORE_GOAL = 20;

export type OrbPick = {
  emotion?: EmotionId;
  island?: IslandId;
  core?: true;
  at: string;
};
export type OrbEntry = Record<string, OrbPick>;
export type OrbsFile = { version: 1; orbs: Record<string, OrbEntry> };
export type OrbPatch = {
  emotion?: EmotionId | null;
  island?: IslandId | null;
  core?: boolean;
};

export type OrbKey =
  { kind: 'day'; date: string } | { kind: 'photo'; eventId: string };

const DAY_KEY = /^day:(\d{4}-\d{2}-\d{2})$/;
const PHOTO_KEY = /^photo:([\w.:-]{1,200})$/;

export const dayKey = (date: string) => `day:${date}`;
export const photoKey = (eventId: string) => `photo:${eventId}`;

export function parseOrbKey(key: string): OrbKey | undefined {
  const day = DAY_KEY.exec(key)?.[1];
  if (day) return { kind: 'day', date: day };
  const photo = PHOTO_KEY.exec(key)?.[1];
  return photo ? { kind: 'photo', eventId: photo } : undefined;
}

export const emptyOrbs = (): OrbsFile => ({ version: 1, orbs: {} });

export const emotionOf = (id: string | undefined) =>
  EMOTIONS.find((e) => e.id === id);
export const islandOf = (id: string | undefined) =>
  ISLANDS.find((i) => i.id === id);

export function applyPatch(
  file: OrbsFile,
  key: string,
  personId: string,
  patch: OrbPatch,
  now: string,
): OrbsFile {
  const entry = { ...file.orbs[key] };
  const next: Partial<OrbPick> = { ...entry[personId] };
  if (patch.emotion !== undefined) {
    if (patch.emotion) next.emotion = patch.emotion;
    else delete next.emotion;
  }
  if (patch.island !== undefined) {
    if (patch.island) next.island = patch.island;
    else delete next.island;
  }
  if (patch.core !== undefined) {
    if (patch.core) next.core = true;
    else delete next.core;
  }
  delete next.at;
  if (Object.keys(next).length) entry[personId] = { ...next, at: now };
  else delete entry[personId];
  const orbs = { ...file.orbs };
  if (Object.keys(entry).length) orbs[key] = entry;
  else delete orbs[key];
  return { version: 1, orbs };
}

export function orbHalves(
  entry: OrbEntry | undefined,
  pair: readonly string[],
): [string, string] {
  const colour = (id: string | undefined) =>
    (id && emotionOf(entry?.[id]?.emotion)?.color) || EMPTY_HALF;
  return [colour(pair[0]), colour(pair[1])];
}

export function orbBackground(halves: readonly [string, string]): string {
  return [
    'radial-gradient(circle at 32% 26%, rgb(255 255 255 / 0.9) 0 7%, rgb(255 255 255 / 0.35) 16%, rgb(255 255 255 / 0) 34%)',
    `linear-gradient(135deg, ${halves[0]} 0 50%, ${halves[1]} 50% 100%)`,
  ].join(', ');
}

export const isCore = (entry: OrbEntry | undefined, pair: readonly string[]) =>
  pair.length > 0 && pair.every((id) => entry?.[id]?.core === true);

export const hasEmotion = (
  entry: OrbEntry | undefined,
  emotion: EmotionId,
  pair: readonly string[],
) => pair.some((id) => entry?.[id]?.emotion === emotion);

export const onIsland = (
  entry: OrbEntry | undefined,
  island: IslandId,
  pair: readonly string[],
) => pair.some((id) => entry?.[id]?.island === island);

export type OrbTally = {
  emotions: Record<EmotionId, number>;
  islands: Record<IslandId, number>;
};

export function tallyOrbs(
  entries: Iterable<OrbEntry | undefined>,
  pair: readonly string[],
): OrbTally {
  const emotions = Object.fromEntries(
    EMOTION_IDS.map((id) => [id, 0]),
  ) as Record<EmotionId, number>;
  const islands = Object.fromEntries(ISLAND_IDS.map((id) => [id, 0])) as Record<
    IslandId,
    number
  >;
  for (const entry of entries) {
    for (const e of EMOTION_IDS) if (hasEmotion(entry, e, pair)) emotions[e]++;
    for (const i of ISLAND_IDS) if (onIsland(entry, i, pair)) islands[i]++;
  }
  return { emotions, islands };
}

export const yearOfKey = (key: OrbKey, dateOf: (eventId: string) => string) =>
  (key.kind === 'day' ? key.date : dateOf(key.eventId)).slice(0, 4);

export type PrintRow = { date: string; kind: OrbKey['kind']; path: string };

const csvCell = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function printListCsv(rows: readonly PrintRow[]): string {
  const lines = [
    'date,kind,path',
    ...rows.map((r) => [r.date, r.kind, r.path].map(csvCell).join(',')),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

export type IoTheme = 'night' | 'day';
export const IO_THEME_KEY = 'memories:io-theme';

export const ioThemeScript = () =>
  `try{if(localStorage.getItem(${JSON.stringify(IO_THEME_KEY)})==='day'){const r=document.documentElement;r.dataset.ioTheme='day';r.dataset.scheme='light'}}catch{}`;

export function applyIoTheme(root: HTMLElement, theme: IoTheme) {
  root.dataset['ioTheme'] = theme;
  root.dataset['scheme'] = theme === 'day' ? 'light' : 'dark';
}

export const IO_TABS = [
  { href: '/orbs', label: '記憶球', match: /^\/(orbs(\/|$)|$)/ },
  { href: '/day', label: '日記', match: /^\/day\// },
  { href: '/islands', label: '島嶼', match: /^\/islands/ },
  { href: '/core', label: '核心記憶', match: /^\/core/ },
  { href: '/year', label: '年', match: /^\/(year|month)/ },
] as const;

const declarations = (vars: Record<string, string>, prefix = '') =>
  Object.entries(vars)
    .map(([name, value]) => `--${prefix}${name}:${value};`)
    .join('');

export function insideOutStyle(): string {
  const root = ":root[data-ui='inside-out']";
  return [
    `${root}{${declarations(palette.brand, 'io-')}}`,
    ...Object.entries(palette.themes).map(
      ([theme, vars]) =>
        `${root}[data-io-theme='${theme}']{${declarations(vars)}}`,
    ),
  ].join('');
}
