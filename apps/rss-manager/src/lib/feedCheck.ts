export type FeedFormat = 'rss' | 'atom';

export type FeedMeta = {
  title: string;
  itemCount: number;
};

export type FeedCheckResult = {
  valid: boolean;
  format?: FeedFormat;
  title?: string;
  itemCount?: number;
  error?: string;
};

export function detectFeedFormat(content: string): FeedFormat | null {
  const trimmed = content.trimStart();
  if (/<rss[\s>]/i.test(trimmed)) return 'rss';
  if (/<feed[\s>]/i.test(trimmed)) return 'atom';
  return null;
}

export function extractFeedMeta(content: string, format: FeedFormat): FeedMeta {
  // Strip CDATA wrappers before title matching (WordPress/Ghost feeds use <title><![CDATA[...]]></title>)
  const stripped = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const titleMatch = stripped.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Use word boundary to avoid matching <items>, <itemset>, etc.
  const itemTag = format === 'rss' ? '<item' : '<entry';
  const itemCount = (content.match(new RegExp(`${itemTag}[\\s>/]`, 'gi')) ?? []).length;

  return { title, itemCount };
}

export async function checkFeedUrl(url: string): Promise<FeedCheckResult> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'rss-manager/1.0 feed-validator' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { valid: false, error: `HTTP ${res.status}` };
    }

    const text = await res.text();
    const format = detectFeedFormat(text);

    if (!format) {
      return { valid: false, error: 'Not a valid RSS or Atom feed' };
    }

    const meta = extractFeedMeta(text, format);
    return { valid: true, format, ...meta };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
}
