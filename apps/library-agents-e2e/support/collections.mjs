import { createServer } from 'node:http';

/**
 * A fictional library: every collection app reduced to its `hall-items` and `library-search`
 * routes. None of these books, notebooks or articles exist.
 */
const item = (kind, id, title, color, groups, href, subtitle) => ({
  kind,
  id: String(id),
  title,
  color,
  groups,
  href,
  ...(subtitle ? { subtitle } : {}),
});

const book = (id, title, tags, author, month) =>
  item(
    'book',
    id,
    title,
    '#6d5bd0',
    [...tags.map((t) => `tag:${t}`), `author:${author}`, `month:${month}`],
    `/books?book=${id}`,
    author,
  );

export const SHELVES = {
  books: [
    book(1, 'The Salt Archive', ['sea'], 'Mara Quill', '2026-08'),
    book(2, 'Lantern Weather', ['sea', 'winter'], 'Mara Quill', '2026-08'),
    book(3, 'Northbound Ferry', ['sea'], 'Tobiah Fenn', '2026-07'),
    book(4, 'The Glass Orchard', ['winter'], 'Tobiah Fenn', '2026-09'),
    book(5, '霧中的書店', ['winter'], '林雨川', '2026-09'),
    book(6, 'Copper Tides', ['maps'], 'Oren Vale', '2026-10'),
    book(7, 'A Field Guide to Clouds', ['maps'], 'Oren Vale', '2026-10'),
  ],
  notebooks: [
    item(
      'notebook',
      'n-1',
      'Field Sketches 2026-07',
      '#2f8f83',
      ['status:active', 'month:2026-07'],
      '/notebooks/n-1',
    ),
    item(
      'notebook',
      'n-2',
      'Garden Plans 2026-09',
      '#7a3b2e',
      ['status:archived', 'month:2026-09'],
      '/notebooks/n-2',
    ),
  ],
  rack: [
    item(
      'article',
      'a-1',
      'Notes on Slow Rivers',
      '#3d5a3a',
      ['tag:nature', 'month:2026-10'],
      '/rack?doc=a-1',
      'example.test',
    ),
    item(
      'article',
      'a-2',
      'The Quiet Server Room',
      '#3d5a3a',
      ['tag:homelab', 'month:2026-10'],
      '/rack?doc=a-2',
      'example.test',
    ),
  ],
  kb: [
    item('kb', 'k-1', 'Kites', '#8a6d2f', ['tag:wind'], '/kb/pages/kites'),
    item(
      'kb',
      'k-2',
      'Tide Tables',
      '#8a6d2f',
      ['tag:sea'],
      '/kb/pages/tide-tables',
    ),
  ],
};

const search = (items, q) => {
  const needle = q.toLowerCase();
  return items
    .filter((i) => i.title.toLowerCase().includes(needle))
    .map(({ kind, id, title, href }) => ({ kind, id, title, href }));
};

/** Serves every shelf on a free loopback port and resolves with its origin. */
export function startCollections() {
  const server = createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const [, collection, ...rest] = url.pathname.split('/');
    const items = SHELVES[collection];
    const route = rest.join('/');
    if (items && route === 'api/hall-items') return send(200, { items });
    if (items && route === 'api/library-search')
      return send(200, {
        results: search(items, url.searchParams.get('q') ?? ''),
      });
    return send(404, { error: 'not found' });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ origin: `http://127.0.0.1:${port}`, server });
    });
  });
}
