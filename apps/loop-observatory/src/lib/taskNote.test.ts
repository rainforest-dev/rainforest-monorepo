import { describe, expect, it } from 'vitest';

import { extractSection, parseFrontmatter, replaceSection, stripSection } from './taskNote.js';

const NOTES = /^##\s+Notes\s*$/;
const FEEDBACK = /^##\s+Feedback\s*$/;

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

// A managed work note with the two-section split: `## Notes` (loop outcome,
// rendered read-only) and `## Feedback` (editable tuning, what `tune` reads).
const MANAGED_NOTE = `---
task_id: 105
scope: "work"
---

# [SLA Dashboard] Cloud BE task

> <!-- sync:managed --> Read-only mirror of [Notion](https://n/1) — edit there.

## Notes

- loop outcome: shipped PR #123

## Feedback

<!-- tuning scaffold -->
`;

describe('extractSection', () => {
  it('returns the text under the requested heading', () => {
    const { body } = parseFrontmatter(MANAGED_NOTE);
    expect(extractSection(body, NOTES)).toContain('loop outcome: shipped PR #123');
    expect(extractSection(body, FEEDBACK)).toContain('tuning scaffold');
  });

  it('returns null when the section is absent', () => {
    expect(extractSection('# T\n\nbody', FEEDBACK)).toBeNull();
  });
});

describe('stripSection', () => {
  it('drops the Feedback section but keeps the Notes outcome (drives the read-only display)', () => {
    const { body } = parseFrontmatter(MANAGED_NOTE);
    const shown = stripSection(body, FEEDBACK);
    expect(shown).toContain('loop outcome: shipped PR #123');
    expect(shown).toContain('## Notes');
    expect(shown).not.toContain('## Feedback');
    expect(shown).not.toContain('tuning scaffold');
  });

  it('returns the body unchanged when the section is absent', () => {
    const body = '# T\n\n## Notes\n\nx';
    expect(stripSection(body, FEEDBACK)).toBe(body);
  });
});

describe('replaceSection (Feedback channel)', () => {
  it('replaces only the Feedback body, preserving frontmatter, title, managed line, and the Notes outcome', () => {
    const out = replaceSection(MANAGED_NOTE, FEEDBACK, '## Feedback', 'split: A / B; points: 2');

    expect(out).toContain('task_id: 105');
    expect(out).toContain('# [SLA Dashboard] Cloud BE task');
    expect(out).toContain('<!-- sync:managed -->');
    expect(out).toContain('- loop outcome: shipped PR #123'); // Notes untouched
    expect(out).toContain('## Feedback');
    expect(out).toContain('split: A / B; points: 2');
    expect(out).not.toContain('tuning scaffold'); // old feedback replaced
  });

  it('appends a Feedback section when the note has none, keeping Notes', () => {
    const out = replaceSection(
      '---\nx: 1\n---\n\n# Title\n\n## Notes\n\nkeep\n',
      FEEDBACK,
      '## Feedback',
      'hello',
    );
    expect(out).toContain('## Notes');
    expect(out).toContain('keep');
    expect(out).toContain('## Feedback');
    expect(out).toContain('hello');
  });

  it('preserves a sibling section that follows Feedback', () => {
    const withTail = '# T\n\n## Feedback\n\nold\n\n## Other\n\nkeep me\n';
    const out = replaceSection(withTail, FEEDBACK, '## Feedback', 'new');
    expect(out).toContain('new');
    expect(out).not.toContain('old');
    expect(out).toContain('## Other');
    expect(out).toContain('keep me');
  });
});
