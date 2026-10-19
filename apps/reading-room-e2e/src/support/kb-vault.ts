import fs from 'node:fs';
import path from 'node:path';

/**
 * The knowledge base's two read-only mounts, fictional. Each private entry carries
 * a marker word that must never reach a page, a search result or the hall.
 */
export const KB_DIR = path.join(__dirname, '..', '..', 'test-output', 'kb');
export const KB_WIKI_DIR = path.join(KB_DIR, 'wiki');
export const KB_READWISE_DIR = path.join(KB_DIR, 'readwise');

export const HIDDEN_MARKERS = ['Moonvault', 'Starcellar', 'Owlpost', 'Fogbank'];

const FILES: Record<string, string> = {
  'wiki/tech-kites.md': `---
wiki_tag: tech/kites
wiki_status: growing
wiki_updated: 2026-02-03
---

# Kites

## Summary
Kites ride the wind. They pair with [[pages/wind|steady wind]] and [[pages/string]].

## Key Points
- Box kites lift heavy loads — [[notes/hobbies/box-kites]]
- A private note — [[notes/personal/Moonvault-diary]]
- A hidden page — [[pages/moonvault-plans]]
- Built for Glimmerco under contract

## Sources
[[readwise/articles/2026-02-01 - Kite Flying Basics - example.org]]
`,
  'wiki/wind.md': `---
wiki_tag: wind
wiki_status: stub
---

# Wind

## Summary
Wind is what [[pages/tech-kites]] need.
`,
  'wiki/string.md': `---
wiki_tag: string
---

# String

## Summary
String keeps [[tech-kites|the kite]] tethered.
`,
  'wiki/moonvault-plans.md': `---
wiki_tag: moonvault-plans
private: true
---

# Moonvault plans

## Summary
Kites over the Moonvault.
`,
  'wiki/starcellar.md': `---
wiki_tag: starcellar
wiki_exclude: true
---

# Starcellar

## Summary
Kites in the Starcellar.
`,
  'wiki/client-portal.md': `---
wiki_tag: client-portal
---

# Client portal

## Summary
The Glimmerco portal flies kites.
`,
  'readwise/articles/2026-02-01 - Kite Flying Basics - example.org.md': `---
author: "example.org"
tags: ["tech/kites"]
url: "https://example.org/kites"
updated: 2026-02-01
---
# Kite Flying Basics

## Highlights
- Launch with the wind at your back.
`,
  'readwise/books/2025-01-01 - Owlpost Letters - Someone.md': `---
tags: ["personal/letters"]
---
# Owlpost Letters

- Kites in letters.
`,
  'readwise/personal/2025-01-01 - Fogbank.md': `# Fogbank

- Kites in fog.
`,
};

export function resetKbVault(): void {
  fs.rmSync(KB_DIR, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(FILES)) {
    const file = path.join(KB_DIR, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf-8');
  }
}
