import { fnv1a } from '@rainforest-dev/search';
import { describe, expect, it } from 'vitest';

import { bookDocText, COMMENTS_LIMIT, toBookDoc } from './docs';

const ROW = {
  id: 7,
  title: 'Iron Tide Almanac',
  authors: 'Tobiah Quell',
  series: '',
  tags: 'winter, sea',
  comments: '<p>A <b>tide</b> table&nbsp;for &amp; sailors.</p>',
};

describe('book docs', () => {
  it('joins the fields and strips HTML from comments', () => {
    expect(bookDocText(ROW)).toBe(
      'Iron Tide Almanac\nTobiah Quell\nwinter, sea\nA tide table for & sailors.',
    );
  });

  it('decodes each entity once', () => {
    expect(
      bookDocText({ ...ROW, comments: '<p>&amp;lt;b&amp;gt; &#39;x&#39;</p>' })
        .split('\n')
        .at(-1),
    ).toBe("&lt;b&gt; 'x'");
  });

  it('clips comments to the limit', () => {
    const text = bookDocText({
      ...ROW,
      comments: `<p>${'字'.repeat(1500)}</p>`,
    });
    expect(text.split('\n').at(-1)).toHaveLength(COMMENTS_LIMIT);
  });

  it('hashes the text with FNV-1a', () => {
    const doc = toBookDoc(ROW);
    expect(doc).toEqual({
      id: '7',
      text: bookDocText(ROW),
      contentHash: fnv1a(bookDocText(ROW)),
    });
  });
});
