import {
  announce,
  lastQuery,
  openLibraryChannel,
  pushRecent,
  recentItems,
  rememberQuery,
  rememberReturnPoint,
  returnPoint,
} from './shared-state';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('return points', () => {
  it('remembers where a collection was left', () => {
    rememberReturnPoint('books', '/books?tag=3&book=9');
    expect(returnPoint('books')).toBe('/books?tag=3&book=9');
    expect(returnPoint('kb')).toBeNull();
  });

  it.each(['//evil.example/x', 'https://evil.example', 'books'])(
    'refuses the off-origin %s',
    (href) => {
      rememberReturnPoint('books', href);
      expect(returnPoint('books')).toBeNull();
    },
  );

  it('ignores a tampered value', () => {
    sessionStorage.setItem('library:return:books', '"//evil.example"');
    expect(returnPoint('books')).toBeNull();
  });
});

describe('last query', () => {
  it('round-trips and treats blank as none', () => {
    rememberQuery('  react  ');
    expect(lastQuery()).toBe('react');
    rememberQuery(' ');
    expect(lastQuery()).toBeNull();
  });
});

describe('recent items', () => {
  const item = (id: string) => ({
    collection: 'books' as const,
    id,
    title: `Book ${id}`,
    href: `/books?book=${id}`,
  });

  it('keeps newest first, without duplicates, capped at 20', () => {
    for (let i = 1; i <= 25; i++) pushRecent(item(String(i)));
    pushRecent(item('10'));
    const ids = recentItems().map((r) => r.id);
    expect(ids).toHaveLength(20);
    expect(ids[0]).toBe('10');
    expect(ids.filter((id) => id === '10')).toHaveLength(1);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('library:recent', '{not json');
    expect(recentItems()).toEqual([]);
    localStorage.setItem('library:recent', '[{"id":1}]');
    expect(recentItems()).toEqual([]);
  });
});

describe('library channel', () => {
  it('delivers valid notices from another tab and drops the rest', async () => {
    const received: unknown[] = [];
    const listener = openLibraryChannel((m) => received.push(m));
    const raw = new BroadcastChannel('library');
    raw.postMessage({ type: 'reload' });
    announce({ type: 'items-changed', collection: 'notebooks' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    raw.close();
    listener.close();
    expect(received).toEqual([
      { type: 'items-changed', collection: 'notebooks' },
    ]);
  });
});
