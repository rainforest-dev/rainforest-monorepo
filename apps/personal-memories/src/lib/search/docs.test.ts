import { describe, expect, it } from 'vitest';

import { noteDoc } from './docs.ts';
import { contentHash } from './text.ts';

describe('noteDoc', () => {
  it('joins the body and annotations, and is undefined when blank', () => {
    expect(noteDoc('2025-11-01', '吃了拉麵', [{ body: '好吃' }])).toMatchObject(
      {
        id: 'note:2025-11-01',
        day: '2025-11-01',
        kind: 'note',
        source: 'note',
        text: '吃了拉麵\n好吃',
      },
    );
    expect(noteDoc('2025-11-01', '  ', [{ body: '' }])).toBeUndefined();
  });
});

describe('contentHash', () => {
  it('is stable for equal text and differs otherwise', () => {
    expect(contentHash('拉麵')).toBe(contentHash('拉麵'));
    expect(contentHash('拉麵')).not.toBe(contentHash('拉面'));
  });
});
