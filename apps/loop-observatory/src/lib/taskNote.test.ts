import { describe, expect, it } from 'vitest';

import { parseFrontmatter } from './taskNote.js';

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
