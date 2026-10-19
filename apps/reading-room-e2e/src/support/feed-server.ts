import { createServer } from 'node:http';

export const FEED_PORT = 3033;
export const FEED_ORIGIN = `http://127.0.0.1:${FEED_PORT}`;

export const SLOW_FEED_DELAY_MS = 1500;

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Lantern Notes</title>
    <link>${FEED_ORIGIN}/</link>
    <description>A fictional feed for the e2e suite</description>
    <item><title>First lantern</title><link>${FEED_ORIGIN}/1</link></item>
    <item><title>Second lantern</title><link>${FEED_ORIGIN}/2</link></item>
    <item><title>Third lantern</title><link>${FEED_ORIGIN}/3</link></item>
  </channel>
</rss>
`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title><![CDATA[Velvet DOM]]></title>
  <id>urn:e2e:velvet-dom</id>
  <updated>2026-09-30T00:00:00Z</updated>
  <entry><title>One</title><id>urn:e2e:1</id><updated>2026-09-30T00:00:00Z</updated></entry>
  <entry><title>Two</title><id>urn:e2e:2</id><updated>2026-09-29T00:00:00Z</updated></entry>
</feed>
`;

const HTML = `<!doctype html>
<html><head><title>Not a feed</title></head><body><p>Just a page.</p></body></html>
`;

interface Route {
  status: number;
  type: string;
  body: string;
  delayMs?: number;
}

const ROUTES: Record<string, Route> = {
  '/feeds/rss.xml': { status: 200, type: 'application/rss+xml', body: RSS },
  '/feeds/atom.xml': { status: 200, type: 'application/atom+xml', body: ATOM },
  '/feeds/page.html': { status: 200, type: 'text/html', body: HTML },
  '/lantern-notes/rss.xml': {
    status: 200,
    type: 'application/rss+xml',
    body: RSS,
  },
  '/velvet-dom/atom.xml': {
    status: 200,
    type: 'application/atom+xml',
    body: ATOM,
  },
  '/feeds/slow.xml': {
    status: 200,
    type: 'application/rss+xml',
    body: RSS,
    delayMs: SLOW_FEED_DELAY_MS,
  },
};

export const FEEDS = {
  rss: `${FEED_ORIGIN}/feeds/rss.xml`,
  atom: `${FEED_ORIGIN}/feeds/atom.xml`,
  html: `${FEED_ORIGIN}/feeds/page.html`,
  missing: `${FEED_ORIGIN}/feeds/missing.xml`,
  slow: `${FEED_ORIGIN}/feeds/slow.xml`,
} as const;

export function startFeedServer(): Promise<() => Promise<void>> {
  const server = createServer((req, res) => {
    const route = ROUTES[new URL(req.url ?? '/', FEED_ORIGIN).pathname];
    const send = (): void => {
      if (!route) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      res.writeHead(route.status, { 'Content-Type': route.type });
      res.end(route.body);
    };
    if (route?.delayMs) setTimeout(send, route.delayMs);
    else send();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(FEED_PORT, '127.0.0.1', () =>
      resolve(
        () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      ),
    );
  });
}
