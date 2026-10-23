/**
 * The shared topic vocabulary. Each collection tags in its own words: Calibre has bookstore
 * categories (`藝術設計`, `COMPUTERS / Web / Design`), Reader and the knowledge base have the
 * vault's tags (`domain/frontend`, `tech/react`). The map names one topic for each set of
 * words, so a book, an article and a wiki page on the same subject share a bookcase.
 *
 * It is a Markdown table in the vault, one topic per row: the topic in the first cell, and every
 * tag that means it as `code` in the cells after it.
 *
 * | 主題 | 標籤 |
 * | --- | --- |
 * | 前端 | `domain/frontend` `tech/react` `COMPUTERS / Web / Web Programming` |
 *
 * A row without a code span is a header or a note and is skipped. A tag listed under two topics
 * belongs to the first.
 */
export type TopicMap = ReadonlyMap<string, string>;

/** The form a tag is compared in: case, width and spacing do not matter. */
export function topicKey(tag: string): string {
  return tag.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** A cell's text without Markdown decoration: `[[link|label]]`, `**bold**`, backticks. */
function cellText(cell: string): string {
  return cell
    .replace(/\\\|/g, '|')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/[`*]/g, '')
    .trim();
}

export function parseTopicMap(markdown: string): TopicMap {
  const map = new Map<string, string>();
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trimStart().startsWith('|')) continue;
    // An Obsidian link inside a table escapes its pipe: `[[page\|label]]`.
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/);
    const [first = '', ...rest] = cells;
    const tags = [...rest.join('|').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const topic = cellText(first);
    if (!topic || tags.length === 0) continue;
    for (const tag of [topic, ...tags]) {
      const key = topicKey(tag ?? '');
      if (key && !map.has(key)) map.set(key, topic);
    }
  }
  return map;
}

/** The topic a tag belongs to, or the tag itself when the map does not list it. */
export function mapTopic(tag: string, map: TopicMap): string {
  return map.get(topicKey(tag)) ?? tag.trim();
}

/** Group prefixes that carry a topic: the shared one and the one it replaced. */
const TOPIC_PREFIXES = ['topic:', 'tag:'];

/**
 * An item's groups with every topic renamed to its topic in the map. Two tags that land on the
 * same topic leave one group, in the place of the first, so the item's first topic stays first.
 */
export function mapTopicGroups(
  groups: readonly string[],
  map: TopicMap,
): string[] {
  if (map.size === 0) return [...groups];
  const out: string[] = [];
  for (const group of groups) {
    const prefix = TOPIC_PREFIXES.find((p) => group.startsWith(p));
    const mapped =
      prefix && group.length > prefix.length
        ? `${prefix}${mapTopic(group.slice(prefix.length), map)}`
        : group;
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out;
}
