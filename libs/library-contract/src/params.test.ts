import { parseSharedParams, sharedHref } from './params';

describe('parseSharedParams', () => {
  it('reads only the shared keys and trims them', () => {
    expect(
      parseSharedParams('q=%20react%20&tag=frontend&page=3&group=&view=hall'),
    ).toEqual({ q: 'react', tag: 'frontend', group: null, view: 'hall' });
  });

  it('accepts a Next searchParams record', () => {
    expect(parseSharedParams({ tag: ['a', 'b'], q: undefined })).toEqual({
      q: null,
      tag: 'a',
      group: null,
      view: null,
    });
  });
});

describe('sharedHref', () => {
  it('carries a filter to another collection', () => {
    const current = parseSharedParams('tag=frontend&sortBy=added');
    expect(sharedHref('/', current)).toBe('/?tag=frontend');
  });

  it('drops empty values', () => {
    expect(sharedHref('/books', { q: '  ', tag: null })).toBe('/books');
  });

  it('encodes values', () => {
    expect(sharedHref('/kb', { tag: '前端 & UI' })).toBe(
      '/kb?tag=%E5%89%8D%E7%AB%AF+%26+UI',
    );
  });
});
