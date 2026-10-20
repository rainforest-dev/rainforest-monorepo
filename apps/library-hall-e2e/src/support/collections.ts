import { createServer } from 'node:http';

/** Stands in for every collection app: each serves its shelf at `<basePath>/api/hall-items`. */
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
    groups: ['month:2026-07'],
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

export function startCollections(): Promise<() => Promise<void>> {
  const server = createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url === '/books/api/hall-items') return send(200, { items: BOOKS });
    if (req.url === '/notebooks/api/hall-items')
      return send(200, { items: NOTEBOOKS });
    // The rack is down, so the hall shows the rest and says which collection is missing.
    return send(500, { error: 'down' });
  });
  return new Promise((resolve) => {
    server.listen(COLLECTIONS_PORT, '127.0.0.1', () =>
      resolve(() => new Promise<void>((done) => server.close(() => done()))),
    );
  });
}
