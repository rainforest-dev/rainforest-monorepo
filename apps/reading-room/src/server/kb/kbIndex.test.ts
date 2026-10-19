import { rmSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { kbHallItems, searchKb } from '@/lib/kb';

import {
  FIXTURE_FILES,
  type FixtureVault,
  writeFixtureVault,
} from './kb.fixtures.js';
import {
  buildKbIndex,
  getKbIndex,
  type KbIndex,
  renderKbDoc,
} from './kbIndex.js';

let vault: FixtureVault;
let index: KbIndex;

beforeAll(() => {
  vault = writeFixtureVault();
  index = buildKbIndex(vault.config);
});
afterAll(() => rmSync(vault.root, { recursive: true, force: true }));

const render = (id: string) => renderKbDoc(index, id, vault.config);

/** Everything a reader or the hall could ever see, as one string. */
function everythingVisible(): string {
  const pages = index.docs.map((d) => render(d.id) ?? '').join('\n');
  return [
    JSON.stringify(index.docs),
    JSON.stringify(index.entries),
    JSON.stringify(kbHallItems(index.docs)),
    pages,
  ].join('\n');
}

describe('what the knowledge base shows', () => {
  it('lists the visible wiki pages and Readwise documents only', () => {
    expect(index.docs.map((d) => d.id).sort()).toEqual([
      'readwise:articles/2026-01-01 - Light and Shade - example.org',
      'wiki:domain-light',
      'wiki:light-and-shade-notes',
      'wiki:q-why-lanterns',
      'wiki:tea',
      'wiki:tech-lanterns',
    ]);
    expect(index.mounted).toEqual({ wiki: true, readwise: true });
  });

  it.each([
    ['private: true', 'heist'],
    ['wiki_exclude: "true"', 'smuggling'],
    ['a personal/ tag', 'check-ups'],
    ['a personal/ tag on a Readwise book', 'in the diary'],
    ['a private folder', 'private folder'],
    ['frontmatter that cannot be read', 'broken header'],
    ['a symlink out of the mount', 'outside the mounts'],
    ['a company summary', 'gates lantern access'],
    ['a company line on a visible page', 'Contractor detail'],
    ['the name of a private page', 'secret-plans'],
    ['the name of an excluded page', 'excluded-topic'],
    ['the path of a private note', 'diary-2026'],
    ['the name of a hidden page in a subfolder', 'quietwhisker'],
  ])('never shows content kept out by %s', (_why, text) => {
    expect(everythingVisible().toLowerCase()).not.toContain(text.toLowerCase());
  });

  it('never names a redacted term anywhere, in link URLs, authors or source URLs either', () => {
    const visible = everythingVisible().toLowerCase();
    expect(visible).not.toContain('acme widgets');
    expect(visible).not.toContain('acmecorp');
    expect(visible).not.toContain('vendor notes');
    expect(visible).not.toContain('shipping lanterns');
  });

  it('finds nothing hidden by search, not even a hidden page linked from a visible one', () => {
    expect(searchKb(index.entries, 'heist')).toEqual([]);
    expect(searchKb(index.entries, 'secret-plans')).toEqual([]);
    expect(searchKb(index.entries, 'diary-2026')).toEqual([]);
    expect(searchKb(index.entries, 'acme')).toEqual([]);
    expect(searchKb(index.entries, 'shade')[0]?.doc.title).toBe(
      'Light and Shade',
    );
  });

  it('does not serve a page whose tags name a redacted term after it was indexed', async () => {
    const { writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fresh = buildKbIndex(vault.config);
    const file = join(vault.config.roots.wiki, 'tea.md');
    try {
      writeFileSync(
        file,
        '---\nwiki_tag: acmecorp/tea\n---\n# Tea\n\nTea.\n',
        'utf-8',
      );
      expect(renderKbDoc(fresh, 'wiki:tea', vault.config)).toBeNull();
    } finally {
      writeFileSync(file, FIXTURE_FILES['wiki/tea.md'], 'utf-8');
    }
  });

  it('renders a page whose extension is upper case', async () => {
    const { rmSync: rm, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const file = join(vault.config.roots.wiki, 'loud.MD');
    try {
      writeFileSync(
        file,
        '---\nwiki_tag: loud\n---\n# Loud\n\nShouting lanterns.\n',
        'utf-8',
      );
      const fresh = buildKbIndex(vault.config);
      expect(renderKbDoc(fresh, 'wiki:loud', vault.config)).toContain(
        'Shouting lanterns.',
      );
    } finally {
      rm(file);
    }
  });

  it('does not serve a page made private after it was indexed', async () => {
    const { writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fresh = buildKbIndex(vault.config);
    const file = join(vault.config.roots.wiki, 'tea.md');
    const original = FIXTURE_FILES['wiki/tea.md'];
    try {
      writeFileSync(
        file,
        '---\nwiki_tag: tea\nprivate: true\n---\n# Tea\n',
        'utf-8',
      );
      expect(renderKbDoc(fresh, 'wiki:tea', vault.config)).toBeNull();
    } finally {
      writeFileSync(file, original, 'utf-8');
    }
  });
});

describe('wikilinks', () => {
  const lanterns = () => render('wiki:tech-lanterns') ?? '';

  it('links wiki pages and Readwise documents inside the knowledge base', () => {
    const html = lanterns();
    expect(html).toContain(
      '<a href="/kb/pages/domain-light" data-kind="kb">light</a>',
    );
    expect(html).toContain('<a href="/kb/pages/tea" data-kind="kb">Tea</a>');
    expect(html).toContain(
      'href="/kb/readwise/articles/2026-01-01%20-%20Light%20and%20Shade%20-%20example.org"',
    );
  });

  it('opens notes that are not mounted in Obsidian', () => {
    expect(lanterns()).toContain(
      'href="obsidian://open?vault=fixture-vault&#x26;file=notes%2Fcrafts%2Fpaper-folding"',
    );
  });

  it('withholds the path and name of a private note', () => {
    const html = lanterns();
    expect(html).not.toContain('diary-2026');
    expect(html).toContain('<span data-kind="private">私人筆記</span>');
  });

  it('withholds the name of a hidden page and shows a missing one as plain text', () => {
    const html = lanterns();
    expect(html).not.toContain('secret-plans');
    expect(html).not.toContain('excluded-topic');
    expect(
      html.match(/<span data-kind="private">私人筆記<\/span>/g),
    ).toHaveLength(4);
    expect(html).toContain('<span data-kind="missing">no-such-page</span>');
    expect(html).not.toContain(
      'obsidian://open?vault=fixture-vault&#x26;file=pages',
    );
  });

  it('links a bare name to the visible page when a hidden file shares it', () => {
    expect(lanterns()).toContain('<a href="/kb/pages/light-and-shade-notes"');
  });

  it('resolves a bare name to a page', () => {
    expect(render('wiki:q-why-lanterns')).toContain('<a href="/kb/pages/tea"');
  });

  it('gives every in-app link a page that exists', () => {
    const hrefs = new Set(index.docs.map((d) => d.href));
    for (const doc of index.docs) {
      const html = render(doc.id) ?? '';
      for (const [, href] of html.matchAll(/href="(\/kb\/[^"]+)"/g))
        expect(hrefs).toContain(href);
    }
  });

  it('records backlinks between visible pages', () => {
    expect(index.backlinks('wiki:tea').map((d) => d.id)).toEqual([
      'wiki:tech-lanterns',
      'wiki:q-why-lanterns',
    ]);
    expect(
      index
        .backlinks(
          'readwise:articles/2026-01-01 - Light and Shade - example.org',
        )
        .map((d) => d.id),
    ).toEqual(['wiki:tech-lanterns']);
  });
});

describe('rendering', () => {
  it('drops raw HTML and unsafe link protocols', () => {
    const html = render('wiki:domain-light') ?? '';
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
    expect(html).toContain(
      '<a href="https://example.org/light" target="_blank" rel="noreferrer">a good one</a>',
    );
  });

  it('takes the title out of the body', () => {
    expect(render('wiki:tea')).not.toContain('<h1>');
    expect(index.get('wiki:tea')?.title).toBe('Tea');
  });
});

describe('getKbIndex', () => {
  it('reports a root that is not mounted as empty', () => {
    const missing = getKbIndex({
      ...vault.config,
      roots: {
        wiki: '/nonexistent/wiki',
        readwise: vault.config.roots.readwise,
      },
    });
    expect(missing.mounted.wiki).toBe(false);
    expect(missing.docs.every((d) => d.source === 'readwise')).toBe(true);
  });
});
