import {
  hallDimensionValue,
  hallGroup,
  hallGroupValue,
  hallItemSchema,
  hallItemsResponseSchema,
  itemTransitionName,
  missingHallDimensions,
} from './hall-items';

const book = {
  kind: 'book',
  id: '42',
  title: 'Dune',
  color: '#3e7d7d',
  groups: ['topic:fiction', 'creator:Frank Herbert', 'month:2026-08'],
  href: '/books?book=42',
};

describe('hallItemSchema', () => {
  it('accepts a well-formed item', () => {
    expect(hallItemSchema.parse(book)).toEqual(book);
  });

  it.each([
    'https://evil.example/x',
    '//evil.example/x',
    '/\\evil',
    'books/42',
  ])('rejects the off-origin href %s', (href) => {
    expect(hallItemSchema.safeParse({ ...book, href }).success).toBe(false);
  });

  it('rejects a colour that is not hex', () => {
    expect(hallItemSchema.safeParse({ ...book, color: 'url(x)' }).success).toBe(
      false,
    );
  });

  it('accepts an optional subtitle and same-origin cover', () => {
    const withCover = {
      ...book,
      subtitle: 'Frank Herbert',
      cover: '/books/api/books/42/cover',
    };
    expect(hallItemSchema.parse(withCover)).toEqual(withCover);
    expect(
      hallItemSchema.safeParse({ ...book, cover: '//evil.example/c.jpg' })
        .success,
    ).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(hallItemSchema.safeParse({ ...book, kind: 'photo' }).success).toBe(
      false,
    );
  });
});

describe('hallItemsResponseSchema', () => {
  it('wraps items in an object', () => {
    expect(hallItemsResponseSchema.parse({ items: [book] }).items).toHaveLength(
      1,
    );
  });
});

describe('hall groups', () => {
  it('reads the first group under a prefix', () => {
    const groups = ['topic:fiction', 'series:dune', 'topic:classic'];
    expect(hallGroupValue(groups, 'topic')).toBe('fiction');
    expect(hallGroupValue(groups, 'creator')).toBeNull();
  });

  it('keeps colons inside the value and skips an empty one', () => {
    expect(hallGroupValue([hallGroup('topic', 'a:b')], 'topic')).toBe('a:b');
    expect(hallGroupValue(['topic:', 'topic:x'], 'topic')).toBe('x');
  });

  it('answers a dimension from its legacy prefix when the new one is absent', () => {
    expect(hallDimensionValue(['tag:fiction'], 'topic')).toBe('fiction');
    expect(hallDimensionValue(['author:Le Guin'], 'creator')).toBe('Le Guin');
    expect(hallDimensionValue(['tag:old', 'topic:new'], 'topic')).toBe('new');
    expect(hallDimensionValue(['tag:2026-08'], 'month')).toBeNull();
  });

  it('names the dimensions an item leaves unanswered', () => {
    expect(
      missingHallDimensions({
        groups: ['topic:sea', 'creator:Oren', 'month:2026-08'],
      }),
    ).toEqual([]);
    // Legacy keys still shelve the item, but the check asks for the new ones.
    expect(
      missingHallDimensions({ groups: ['tag:sea', 'month:2026-08'] }),
    ).toEqual(['topic', 'creator']);
  });
});

describe('itemTransitionName', () => {
  it('names a book cover book-<id>', () => {
    expect(itemTransitionName('book', '42')).toBe('book-42');
  });

  it('turns characters a CSS ident cannot hold into underscores', () => {
    expect(itemTransitionName('kb', 'tech/react page')).toBe(
      'kb-tech_react_page',
    );
  });
});
