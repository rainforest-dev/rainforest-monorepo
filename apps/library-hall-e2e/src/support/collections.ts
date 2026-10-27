import { createServer } from 'node:http';

/**
 * Stands in for every collection app: each serves its shelf at `<basePath>/api/hall-items` and
 * its search at `<basePath>/api/library-search`.
 */
export const COLLECTIONS_PORT = 3041;
export const COLLECTIONS_ORIGIN = `http://127.0.0.1:${COLLECTIONS_PORT}`;

const book = (id: number, title: string, tags: string[], author: string) => ({
  kind: 'book',
  id: String(id),
  title,
  color: '#6d5bd0',
  groups: [...tags.map((t) => `tag:${t}`), `author:${author}`, 'month:2026-08'],
  href: `/books?book=${id}`,
  subtitle: author,
});

/** A fictional shelf: none of these books exist. */
export const BOOKS = [
  book(1, 'The Salt Archive', ['sea'], 'Mara Quill'),
  book(2, 'Lantern Weather', ['sea', 'winter'], 'Mara Quill'),
  book(3, 'Northbound Ferry', ['sea'], 'Tobiah Fenn'),
  book(4, 'The Glass Orchard', ['winter'], 'Tobiah Fenn'),
  book(5, '霧中的書店', ['winter'], '林雨川'),
  book(6, 'Copper Tides', [], 'Oren Vale'),
];

export const NOTEBOOKS = [
  {
    kind: 'notebook',
    id: 'n-1',
    title: 'Field Sketches',
    color: '#2f8f83',
    // `ocean` is a word the books never use; the topic map files it under their `sea`.
    groups: ['topic:ocean', 'month:2026-07'],
    href: '/notebooks/n-1',
  },
  {
    kind: 'notebook',
    id: 'n-2',
    title: 'Garden Plans',
    color: '#2f8f83',
    groups: ['month:2026-09'],
    href: '/notebooks/n-2',
  },
];

/** The vault's topic map, as the hall reads it from `LIBRARY_TOPIC_MAP`. */
export const TOPIC_MAP = `# Topic Map

| Topic | Tags |
| --- | --- |
| sea | \`ocean\` |
`;

type Item = (typeof BOOKS)[number] | (typeof NOTEBOOKS)[number];

/** A title match, shaped like a collection's search hit. */
function search(items: Item[], q: string) {
  const needle = q.toLowerCase();
  return items
    .filter((item) => item.title.toLowerCase().includes(needle))
    .map(({ kind, id, title, href }) => ({ kind, id, title, href }));
}

/**
 * Taipei's weather, shaped like Open-Meteo's current conditions: overcast at 22 °C. Not rain,
 * which redraws the scene 30 times a second and slows every other test in the software
 * renderer; `?hallWeather=rain` covers it.
 */
export const WEATHER = {
  current: { weather_code: 3, cloud_cover: 100, temperature_2m: 22.4 },
};

/** A day `offset` days from today in Taipei, as the events' `YYYY-MM-DD`. */
function day(offset: number): string {
  return new Date(Date.now() + 8 * 3_600_000 + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Fictional exhibitions and a market, dated around today so they always land on the rack. */
export function rackEvents() {
  const event = (
    id: string,
    kind: 'exhibition' | 'market',
    start: number,
    end: number,
    topics: string[],
  ) => ({
    id: `moc:${id}`,
    source: 'moc',
    kind,
    title: id,
    start: day(start),
    end: day(end),
    cities: ['臺北市'],
    topics,
  });
  return [
    event('Tin Robot Parade', 'exhibition', -10, 3, ['toys']),
    event('Moss and Stone', 'exhibition', -5, 40, ['environment']),
    event('Lantern Paper Fair', 'market', 4, 5, ['handmade', 'vegetarian']),
    event('Clockwork Harbour', 'exhibition', 12, 60, []),
  ];
}

export function startCollections(): Promise<() => Promise<void>> {
  const server = createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url ?? '/', COLLECTIONS_ORIGIN);
    const q = url.searchParams.get('q') ?? '';
    if (url.pathname === '/books/api/hall-items')
      return send(200, { items: BOOKS });
    if (url.pathname === '/notebooks/api/hall-items')
      return send(200, { items: NOTEBOOKS });
    if (url.pathname === '/books/api/library-search')
      return send(200, { results: search(BOOKS, q) });
    if (url.pathname === '/notebooks/api/library-search')
      return send(200, { results: search(NOTEBOOKS, q) });
    if (url.pathname === '/weather') return send(200, WEATHER);
    // The rack's shelf is down, but its events still answer.
    if (url.pathname === '/rack/api/events')
      return send(200, { events: rackEvents(), fetchedAt: null, failed: [] });
    // The rack is down, so the hall shows the rest and says which collection is missing.
    return send(500, { error: 'down' });
  });
  return new Promise((resolve) => {
    server.listen(COLLECTIONS_PORT, '127.0.0.1', () =>
      resolve(() => new Promise<void>((done) => server.close(() => done()))),
    );
  });
}
