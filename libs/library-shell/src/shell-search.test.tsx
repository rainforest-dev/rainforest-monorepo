import { fireEvent, render, screen, within } from '@testing-library/react';

import { ShellSearch } from './shell-search';

const respond = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ShellSearch', () => {
  it('lists every collection’s hits as links and names a silent collection', async () => {
    const fetchMock = vi.fn(() =>
      respond({
        results: [
          {
            kind: 'book',
            id: '1',
            title: 'Harbour Ledger',
            subtitle: 'Mara Ostrand',
            href: '/books?book=1',
          },
          {
            kind: 'notebook',
            id: 'page-4',
            title: '2026-A5 · p. 4',
            snippet: 'harbour walk',
            href: '/notebooks/2?page=4',
          },
        ],
        sources: [
          { collection: 'books', ok: true, count: 1 },
          { collection: 'notebooks', ok: true, count: 1 },
          { collection: 'kb', ok: false, count: 0 },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ShellSearch />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'harbour' },
    });
    const list = await screen.findByRole('listbox', { name: '搜尋結果' });
    const links = await within(list).findAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/books?book=1',
      '/notebooks/2?page=4',
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/search?q=harbour',
      expect.anything(),
    );
    expect(await screen.findByText(/知識庫暫時沒有回應/)).toBeTruthy();
  });

  it('moves through the hits with the arrow keys', async () => {
    vi.stubGlobal('fetch', () =>
      respond({
        results: [
          { kind: 'kb', id: 'a', title: 'A', href: '/kb/a' },
          { kind: 'kb', id: 'b', title: 'B', href: '/kb/b' },
        ],
        sources: [{ collection: 'kb', ok: true, count: 2 }],
      }),
    );
    render(<ShellSearch />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'x' } });
    await screen.findAllByRole('option');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]?.id);
  });

  it('offers each matching collection’s own search for the query', async () => {
    vi.stubGlobal('fetch', () =>
      respond({
        results: [{ kind: 'kb', id: 'a', title: 'A', href: '/kb/a' }],
        sources: [
          { collection: 'books', ok: true, count: 0 },
          { collection: 'kb', ok: true, count: 1 },
          { collection: 'rack', ok: false, count: 0 },
        ],
      }),
    );
    render(<ShellSearch />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: ' kites ' },
    });
    const nav = await screen.findByRole('navigation', {
      name: '在單一館藏裡搜尋',
    });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([['在知識庫裡搜尋', '/kb?q=kites']]);
  });

  it('lets the on-device model narrow the search, and undoes it on request', async () => {
    vi.stubGlobal('LanguageModel', {
      availability: async () => 'available',
      create: async () => ({
        prompt: async () =>
          JSON.stringify({ text: 'react', collections: ['notebooks'] }),
        destroy: () => undefined,
      }),
    });
    const fetchMock = vi.fn(() =>
      respond({
        results: [{ kind: 'notebook', id: 'p', title: 'P', href: '/n/p' }],
        sources: [{ collection: 'notebooks', ok: true, count: 1 }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ShellSearch />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '筆記本裡的 react' },
    });
    expect(await screen.findByText('解讀為：「react」 · 筆記本')).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/search?q=react&in=notebooks',
      expect.anything(),
    );
    fireEvent.click(screen.getByRole('button', { name: '照原文搜尋' }));
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/search?${new URLSearchParams({ q: '筆記本裡的 react' })}`,
        expect.anything(),
      ),
    );
  });

  it('takes focus on ⌘K or Ctrl+K', () => {
    render(<ShellSearch />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(input);
    input.blur();
    fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('keeps the last hits on screen while the next query loads', async () => {
    let answer: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        respond({
          results: [{ kind: 'kb', id: 'a', title: 'Dune', href: '/kb/a' }],
          sources: [{ collection: 'kb', ok: true, count: 1 }],
        }),
      )
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (answer = resolve)),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ShellSearch />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'dune' } });
    await screen.findByRole('option');
    fireEvent.change(input, { target: { value: 'dunes' } });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText('搜尋中…')).toBeTruthy();
    answer(
      new Response(JSON.stringify({ results: [], sources: [] }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(await screen.findByText('找不到符合的項目')).toBeTruthy();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('opens the first hit on Enter, but not mid-composition or while a new search loads', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    let answer: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        respond({
          results: [{ kind: 'kb', id: 'a', title: 'Dune', href: '/kb/a' }],
          sources: [{ collection: 'kb', ok: true, count: 1 }],
        }),
      )
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (answer = resolve)),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ShellSearch />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'dune' } });
    await screen.findByRole('option');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(assign).not.toHaveBeenCalled();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'dunes' } });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(assign).not.toHaveBeenCalled();
    answer(
      new Response(
        JSON.stringify({
          results: [{ kind: 'kb', id: 'b', title: 'Dunes', href: '/kb/b' }],
          sources: [{ collection: 'kb', ok: true, count: 1 }],
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    await screen.findByText('Dunes');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(assign).toHaveBeenCalledWith('/kb/b');
  });

  it('says so when the search fails', async () => {
    vi.stubGlobal('fetch', () => respond({}, 502));
    render(<ShellSearch />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'x' } });
    expect(await screen.findByText('搜尋暫時無法使用')).toBeTruthy();
  });
});
