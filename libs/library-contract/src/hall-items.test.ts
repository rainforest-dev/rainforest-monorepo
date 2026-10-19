import { hallItemSchema, hallItemsResponseSchema } from './hall-items';

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
