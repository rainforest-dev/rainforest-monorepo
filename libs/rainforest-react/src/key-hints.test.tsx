import { render, screen } from '@testing-library/react';

import { type KeyHint, KeyHints } from './index';

const HINTS: readonly KeyHint[] = [
  { keys: ['/'], label: 'Search' },
  { keys: ['Home', 'End'], label: 'Row ends' },
  { keys: ['Esc'], label: 'Close' },
];

describe('KeyHints', () => {
  it('groups every hint’s keys, single keys included', () => {
    const { container } = render(<KeyHints hints={HINTS} />);
    const root = container.querySelector('[data-key-hints]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-slot')).toBe('key-hints');
    const groups = root?.querySelectorAll('[data-slot="kbd-group"]') ?? [];
    expect(groups).toHaveLength(HINTS.length);
    expect(
      [...groups].map((g) =>
        [...g.querySelectorAll('[data-slot="kbd"]')].map((k) => k.textContent),
      ),
    ).toEqual(HINTS.map((h) => h.keys));
  });

  it('renders each label next to its keys', () => {
    render(<KeyHints hints={HINTS} />);
    for (const { label } of HINTS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('merges className and passes other props to the root', () => {
    const { container } = render(
      <KeyHints hints={HINTS} className="hidden gap-x-5 lg:flex" id="hints" />,
    );
    const root = container.querySelector('[data-key-hints]');
    expect(root?.id).toBe('hints');
    const classes = root?.className.split(' ') ?? [];
    expect(classes).toEqual(
      expect.arrayContaining(['hidden', 'lg:flex', 'gap-x-5', 'text-xs']),
    );
    expect(classes).not.toContain('flex');
    expect(classes).not.toContain('gap-x-4');
  });
});
