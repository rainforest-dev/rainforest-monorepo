import { describe, expect, it } from 'vitest';

import { isSummarizable, MIN_PROSE_CHARS, toProse } from './article-text';

// The motivating case, verbatim in shape: web-ai.mdx is imports, headings and island tags with
// almost no prose. Fed raw to the real Summarizer it echoed the source back — imports included —
// as its "summary".
const WEB_AI_LIKE = `import { Baseline } from '@components/blog';
import { CheckGPU } from '@components/blog/demo';

## GPU support check

<Baseline featureId="webgpu" />

<CheckGPU client:load />

## Edge AI on Web Platforms

{/* <WebLLM client:load /> */}
`;

describe('toProse', () => {
  it('drops ES imports and exports', () => {
    expect(toProse(WEB_AI_LIKE)).not.toMatch(/import|@components/);
  });

  it('drops self-closing island tags but keeps paired-tag text', () => {
    expect(toProse('<CheckGPU client:load />')).toBe('');
    expect(toProse('<Note>real prose here</Note>')).toBe('real prose here');
  });

  it('drops MDX expression comments', () => {
    expect(toProse('{/* <WebLLM client:load /> */}')).toBe('');
  });

  it('drops fenced code, which is the most token-expensive and least summarizable part', () => {
    expect(toProse('before\n```ts\nconst x = 1;\n```\nafter')).toBe(
      'before\n\nafter',
    );
  });

  it('keeps heading and emphasis words while dropping their syntax', () => {
    expect(toProse('## GPU support check')).toBe('GPU support check');
    expect(toProse('**bold** and `code`')).toBe('bold and code');
  });

  it('reduces a markdown link to its text', () => {
    expect(toProse('see [the spec](https://example.com/spec) for more')).toBe(
      'see the spec for more',
    );
  });

  it('strips a frontmatter fence when the body still carries one', () => {
    expect(toProse('---\ntitle: X\n---\nActual prose.')).toBe('Actual prose.');
  });

  it('leaves ordinary prose alone', () => {
    const prose = 'This is a paragraph.\n\nAnd a second one.';
    expect(toProse(prose)).toBe(prose);
  });
});

describe('isSummarizable', () => {
  it('rejects a post that is mostly imports and island tags', () => {
    // Not a threshold quibble: this reduces to a couple of headings, and summarizing it
    // produced an echo of the source rather than a summary.
    expect(isSummarizable(WEB_AI_LIKE)).toBe(false);
  });

  it('accepts a post with a real body of prose', () => {
    expect(isSummarizable('word '.repeat(MIN_PROSE_CHARS))).toBe(true);
  });

  it('measures prose, not raw length — a long code dump is still not summarizable', () => {
    const codeHeavy = '```ts\n' + 'const x = 1;\n'.repeat(200) + '```';
    expect(codeHeavy.length).toBeGreaterThan(MIN_PROSE_CHARS);
    expect(isSummarizable(codeHeavy)).toBe(false);
  });
});
