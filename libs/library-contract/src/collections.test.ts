import {
  collectionForPath,
  COLLECTIONS,
  getCollection,
  isSameApp,
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
