import {
  hallGroup,
  hallGroupValue,
  hallItemSchema,
  hallItemsResponseSchema,
  itemTransitionName,
} from './hall-items';

const book = {
  kind: 'book',
  id: '42',
  title: 'Dune',
  color: '#3e7d7d',
  groups: ['tag:fiction', 'series:dune'],
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
    const groups = ['tag:fiction', 'series:dune', 'tag:classic'];
    expect(hallGroupValue(groups, 'tag')).toBe('fiction');
    expect(hallGroupValue(groups, 'series')).toBe('dune');
    expect(hallGroupValue(groups, 'author')).toBeNull();
  });

  it('keeps colons inside the value and skips an empty one', () => {
    expect(hallGroupValue([hallGroup('tag', 'a:b')], 'tag')).toBe('a:b');
    expect(hallGroupValue(['tag:', 'tag:x'], 'tag')).toBe('x');
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
