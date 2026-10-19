import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { type KbConfig } from './kbIndex.js';

/**
 * A fictional vault: the knowledge base's two mounts plus a sibling folder they must never
 * reach. Nothing here is real data; the repository is public.
 */
export const FIXTURE_FILES: Record<string, string> = {
  'wiki/tech-lanterns.md': `---
wiki_tag: tech/lanterns
wiki_status: growing
wiki_updated: 2026-01-02
---

# Lanterns

## Summary
Lanterns light the reading room. See [[pages/domain-light|light]] and [[pages/tea]].

## Key Points
- Paper lanterns glow warmly — [[notes/crafts/paper-folding]]
- A private diary mentions lanterns — [[notes/personal/diary-2026]]
- Hidden draft — [[pages/secret-plans]]
- Excluded page — [[pages/excluded-topic]]
- Contractor detail from Acme Widgets internal work
- Unknown page — [[pages/no-such-page]]
- Nested hidden page — [[quietwhisker]]
- Shared name — [[light-and-shade-notes]]

## Sources
[[readwise/articles/2026-01-01 - Light and Shade - example.org]]
`,
  'wiki/domain-light.md': `---
wiki_tag: domain/light
wiki_status: stub
---

# Light

## Summary
Light is what [[pages/tech-lanterns]] make. <script>alert(1)</script>

[a bad link](javascript:alert(1)) and [a good one](https://example.org/light).
`,
  'wiki/tea.md': `---
wiki_tag: tea
---

# Tea

## Summary
Tea pairs with lanterns.
`,
  'wiki/secret-plans.md': `---
wiki_tag: secret-plans
private: true
---

# Secret plans

## Summary
The lantern heist happens at midnight.
`,
  'wiki/excluded-topic.md': `---
wiki_tag: excluded-topic
wiki_exclude: "true"
---

# Excluded topic

## Summary
Lantern smuggling routes.
`,
  'wiki/personal-tagged.md': `---
wiki_tag: personal/health
---

# Health

## Summary
Lantern-lit check-ups.
`,
  'wiki/broken-yaml.md': `---
wiki_tag: [unclosed
private: true
---

# Broken

## Summary
Lantern data behind a broken header.
`,
  'wiki/client-dashboard.md': `---
wiki_tag: client-dashboard
---

# Client dashboard

## Summary
How the Acme Widgets dashboard gates lantern access.
`,
  'wiki/q-why-lanterns.md': `---
wiki_tag: q-why-lanterns
wiki_origin: query
---

# Why lanterns?

## Summary
Because [[tea]] needs light.
`,
  'wiki/light-and-shade-notes.md': `---
wiki_tag: light-and-shade-notes
---

# Light and shade notes

## Summary
Notes on shade.
`,
  'readwise/articles/light-and-shade-notes.md': `---
tags: ["personal/journal"]
---
# Hidden namesake
`,
  'wiki/drafts/quietwhisker.md': `---
wiki_tag: quietwhisker
private: true
---

# Quietwhisker

## Summary
A hidden page in a subfolder.
`,
  'readwise/Readwise Syncs.md': `# Sync log`,
  'readwise/articles/2026-01-01 - Light and Shade - example.org.md': `---
author: "example.org"
tags: ["tech/lanterns", "light"]
category: articles
url: "https://example.org/light-and-shade"
updated: 2026-01-01
---
# Light and Shade

## Highlights
- Shade makes lanterns visible.
`,
  'readwise/books/2025-05-05 - Private Book - Someone.md': `---
author: "Someone"
tags: ["personal/journal"]
---
# Private Book

## Highlights
- A lantern in the diary.
`,
  'readwise/personal/2025-01-01 - Hidden Folder.md': `---
tags: []
---
# Hidden Folder

- Lanterns in a private folder.
`,
  'outside/diary.md': `# Diary

Lanterns outside the mounts.
`,
};

export interface FixtureVault {
  root: string;
  config: KbConfig;
}

/** Writes the fixture vault to a fresh temp directory, with a symlink out of the wiki mount. */
export function writeFixtureVault(): FixtureVault {
  const root = mkdtempSync(join(tmpdir(), 'kb-vault-'));
  for (const [path, content] of Object.entries(FIXTURE_FILES)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf-8');
  }
  symlinkSync(join(root, 'outside'), join(root, 'wiki', 'escape'));
  symlinkSync(
    join(root, 'outside', 'diary.md'),
    join(root, 'wiki', 'diary.md'),
  );
  return {
    root,
    config: {
      roots: { wiki: join(root, 'wiki'), readwise: join(root, 'readwise') },
      vault: 'fixture-vault',
    },
  };
}
