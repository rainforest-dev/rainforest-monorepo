import { act, render, renderHook } from '@testing-library/react';

type Fold = typeof import('./fold');

// The store is module state; each test gets a fresh copy.
async function load(): Promise<Fold> {
  vi.resetModules();
  return import('./fold');
}

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
}

function setSegments(rects: DOMRect[] | undefined) {
  Object.defineProperty(window, 'viewport', {
    configurable: true,
    value: rects ? { segments: rects } : undefined,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setWidth(1024);
  setSegments(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('readFoldState', () => {
  it.each([
    [382, 'compact'],
    [669, 'medium'],
    [951, 'expanded'],
  ])('puts a %ipx window in %s', async (width, size) => {
    const { readFoldState } = await load();
    setWidth(width);
    expect(readFoldState()).toEqual({ size, posture: 'flat', segments: [] });
  });

  it('reads side-by-side segments as book and stacked ones as tabletop', async () => {
    const { readFoldState } = await load();
    setSegments([new DOMRect(0, 0, 320, 800), new DOMRect(340, 0, 320, 800)]);
    expect(readFoldState().posture).toBe('book');
    setSegments([new DOMRect(0, 0, 900, 400), new DOMRect(0, 420, 900, 400)]);
    expect(readFoldState().posture).toBe('tabletop');
  });

  it('treats a single segment as flat', async () => {
    const { readFoldState } = await load();
    setSegments([new DOMRect(0, 0, 900, 800)]);
    expect(readFoldState()).toMatchObject({ posture: 'flat', segments: [] });
  });
});

describe('useFoldState', () => {
  it('reports only the size a fold settles on', async () => {
    const { useFoldState, FOLD_SETTLE_MS } = await load();
    setWidth(382);
    const { result } = renderHook(() => useFoldState());
    expect(result.current?.size).toBe('compact');

    // Unfolding passes through a size that belongs to neither screen.
    act(() => {
      setWidth(466);
      window.dispatchEvent(new Event('resize'));
      setWidth(669);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current?.size).toBe('compact');

    act(() => vi.advanceTimersByTime(FOLD_SETTLE_MS));
    expect(result.current?.size).toBe('medium');
  });

  it('keeps the same object while nothing changes', async () => {
    const { useFoldState, FOLD_SETTLE_MS } = await load();
    const { result } = renderHook(() => useFoldState());
    const first = result.current;
    act(() => {
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(FOLD_SETTLE_MS);
    });
    expect(result.current).toBe(first);
  });
});

describe('useFoldAnchor', () => {
  it('scrolls the remembered anchor back into view after an unfold', async () => {
    const { useFoldAnchor, FOLD_SETTLE_MS } = await load();
    setWidth(382);
    function Page() {
      useFoldAnchor();
      return (
        <>
          <p data-fold-anchor="a">A</p>
          <p data-fold-anchor="b">B</p>
        </>
      );
    }
    const { container } = render(<Page />);
    const [a, b] = container.querySelectorAll('p');
    // The reader has scrolled A off the top.
    a.getBoundingClientRect = () => new DOMRect(0, -200, 300, 40);
    b.getBoundingClientRect = () => new DOMRect(0, 20, 300, 40);
    b.scrollIntoView = vi.fn();
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      vi.runOnlyPendingTimers();
    });

    act(() => {
      setWidth(669);
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(FOLD_SETTLE_MS);
    });
    expect(b.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });
});
