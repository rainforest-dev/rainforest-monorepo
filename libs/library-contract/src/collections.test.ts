import {
  collectionForPath,
  COLLECTIONS,
  getCollection,
  isSameApp,
  pageTitle,
  pageTitleTemplate,
} from './collections';

describe('collectionForPath', () => {
  it.each([
    ['/', 'hall'],
    ['/hall-next', 'hall'],
    ['/books', 'books'],
    ['/books/42', 'books'],
    ['/opds/catalog', 'books'],
    ['/notebooks/7/pages', 'notebooks'],
    ['/rack', 'rack'],
    ['/kb/pages/tech-react', 'kb'],
    ['/bookshelf', 'hall'],
    ['/kbx', 'hall'],
  ])('%s belongs to %s', (path, id) => {
    expect(collectionForPath(path).id).toBe(id);
  });
});

describe('COLLECTIONS', () => {
  it('mounts every collection at a distinct path', () => {
    const paths = COLLECTIONS.flatMap((c) => [c.basePath, ...c.aliases]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('gives every collection a distinct shortcut', () => {
    const keys = COLLECTIONS.map((c) => c.shortcut);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('throws on an unknown id', () => {
    // @ts-expect-error -- exercising the runtime guard
    expect(() => getCollection('photos')).toThrow(/Unknown collection/);
  });
});

describe('isSameApp', () => {
  it('treats the rack and the knowledge base as one app', () => {
    expect(isSameApp('rack', 'kb')).toBe(true);
    expect(isSameApp('books', 'notebooks')).toBe(false);
  });
});

describe('pageTitle', () => {
  it('names the page, then its collection, then the library', () => {
    expect(pageTitle('en', 'books', 'Dune')).toBe(
      'Dune · Books · Rainforest Library',
    );
    expect(pageTitle('zh', 'rack', '雜誌架')).toBe(
      '雜誌架 · 報架 · Rainforest 圖書館',
    );
  });

  it('leaves out the page on a front page and the collection in the hall', () => {
    expect(pageTitle('en', 'notebooks')).toBe('Notebooks · Rainforest Library');
    expect(pageTitle('zh', 'hall')).toBe('Rainforest 圖書館');
  });

  it('gives a Next.js layout the same titles as a template', () => {
    expect(pageTitleTemplate('en', 'books')).toEqual({
      default: 'Books · Rainforest Library',
      template: '%s · Books · Rainforest Library',
    });
  });
});
