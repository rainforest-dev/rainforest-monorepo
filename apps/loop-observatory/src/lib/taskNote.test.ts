import { describe, expect, it } from 'vitest';

import { extractNotesSection, parseFrontmatter, replaceNotesSection } from './taskNote.js';

const WORK_NOTE = `---
task_id: 105
task_ref: "https://app.notion.com/p/abc"
scope: "work"
points: 5
order: 1
tags: [angible, sprint, "task/work"]
---

# Heading

Body text.
`;

describe('parseFrontmatter', () => {
  it('parses scalars, quoted strings, numbers, and arrays', () => {
    const { frontmatter, body } = parseFrontmatter(WORK_NOTE);
    expect(frontmatter.task_id).toBe(105);
    expect(frontmatter.task_ref).toBe('https://app.notion.com/p/abc');
    expect(frontmatter.scope).toBe('work');
    expect(frontmatter.points).toBe(5);
    expect(frontmatter.tags).toEqual(['angible', 'sprint', 'task/work']);
    expect(body.trimStart().startsWith('# Heading')).toBe(true);
  });

  it('returns an empty map and full content when there is no frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('# Just a note\n\ntext');
    expect(frontmatter).toEqual({});
    expect(body).toBe('# Just a note\n\ntext');
  });
});

// A managed work note: frontmatter + title + sync-managed blockquote + a
// scaffold-only Notes section.
const MANAGED_NOTE = `---
task_id: 105
scope: "work"
---

# [SLA Dashboard] Cloud BE task

> <!-- sync:managed --> Read-only mirror of [Notion](https://n/1) — edit there.

## Notes

<!-- your own notes here; preserved across syncs -->
`;

describe('extractNotesSection', () => {
  it('returns the text under ## Notes', () => {
    const { body } = parseFrontmatter(MANAGED_NOTE);
    expect(extractNotesSection(body)).toContain('your own notes here');
  });

  it('returns null when there is no ## Notes section', () => {
    expect(extractNotesSection('# T\n\nbody')).toBeNull();
  });
});

describe('replaceNotesSection', () => {
  it('replaces only the Notes body, preserving frontmatter, title, and the managed line', () => {
    const out = replaceNotesSection(MANAGED_NOTE, 'Re-estimate to 3 points; wrong component.');

    // Preserved verbatim:
    expect(out).toContain('task_id: 105');
    expect(out).toContain('# [SLA Dashboard] Cloud BE task');
    expect(out).toContain('<!-- sync:managed -->');
    // New feedback written under Notes; scaffold replaced:
    expect(out).toContain('## Notes');
    expect(out).toContain('Re-estimate to 3 points; wrong component.');
    expect(out).not.toContain('your own notes here');
    // Ordering: managed line stays above the Notes body.
    expect(out.indexOf('sync:managed')).toBeLessThan(out.indexOf('Re-estimate'));
  });

  it('appends a Notes section when the note has none', () => {
    const out = replaceNotesSection('---\nx: 1\n---\n\n# Title\n\nbody\n', 'hello');
    expect(out).toContain('# Title');
    expect(out).toContain('## Notes');
    expect(out).toContain('hello');
  });

  it('preserves a section that follows ## Notes', () => {
    const withTail = '# T\n\n## Notes\n\nold text\n\n## Other\n\nkeep me\n';
    const out = replaceNotesSection(withTail, 'new text');
    expect(out).toContain('new text');
    expect(out).not.toContain('old text');
    expect(out).toContain('## Other');
    expect(out).toContain('keep me');
  });
});
