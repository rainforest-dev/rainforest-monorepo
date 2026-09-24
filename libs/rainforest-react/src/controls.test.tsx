import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import {
  Checkbox,
  Kbd,
  KbdGroup,
  ScrollArea,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './index';

describe('Sheet', () => {
  it('opens from its trigger, closes on Escape and returns focus', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Notes</SheetTrigger>
        <SheetContent>
          <SheetTitle>這一天的回憶</SheetTitle>
          <SheetDescription>Markdown · 自動儲存</SheetDescription>
          <SheetClose>Done</SheetClose>
        </SheetContent>
      </Sheet>,
    );
    const trigger = screen.getByRole('button', { name: 'Notes' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('data-side')).toBe('right');
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('closes from SheetClose and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Sheet side="left">
        <SheetTrigger>Menu</SheetTrigger>
        <SheetContent showCloseButton={false}>
          <SheetTitle>Menu</SheetTitle>
          <SheetClose>Done</SheetClose>
        </SheetContent>
      </Sheet>,
    );
    const trigger = screen.getByRole('button', { name: 'Menu' });
    await user.click(trigger);
    await user.click(await screen.findByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('labels its close button with closeLabel', async () => {
    render(
      <Sheet defaultOpen>
        <SheetContent closeLabel="關閉">
          <SheetTitle>這一天的回憶</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(await screen.findByRole('button', { name: '關閉' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('mounts a peek sheet without taking focus, expands with focus inside and collapses on Escape', async () => {
    const PEEK = '156px';
    function Notes() {
      const [snap, setSnap] = useState<string | number | null>(PEEK);
      return (
        <>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the test needs focus on the page before the sheet mounts */}
          <button type="button" autoFocus>
            Stream
          </button>
          <output data-testid="snap">{String(snap)}</output>
          <Sheet
            side="bottom"
            open
            onOpenChange={(next) => {
              if (!next) setSnap(PEEK);
            }}
            snapPoints={[PEEK, 1]}
            snapPoint={snap}
            onSnapPointChange={setSnap}
            modal={snap === 1}
            disablePointerDismissal
          >
            <SheetContent
              initialFocus={false}
              showOverlay={false}
              showCloseButton={false}
            >
              <SheetTitle>這一天的回憶</SheetTitle>
              <button
                type="button"
                aria-expanded={snap === 1}
                onClick={() => setSnap(snap === 1 ? PEEK : 1)}
              >
                展開筆記
              </button>
            </SheetContent>
          </Sheet>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Notes />);
    const stream = screen.getByRole('button', { name: 'Stream' });
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('data-side')).toBe('bottom');
    expect(dialog.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(stream);

    const expand = screen.getByRole('button', { name: '展開筆記' });
    await user.click(expand);
    expect(screen.getByTestId('snap').textContent).toBe('1');
    await waitFor(() => expect(document.activeElement).toBe(expand));

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.getByTestId('snap').textContent).toBe(PEEK),
    );
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(expand);
  });
});

describe('Tooltip', () => {
  it('shows on keyboard focus and hides on Escape with focus kept on the trigger', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger aria-label="Previous day">←</TooltipTrigger>
          <TooltipContent>前一天</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Previous day' });
    expect(document.activeElement).toBe(trigger);
    expect(await screen.findByText('前一天')).not.toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('前一天')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});

describe('ToggleGroup', () => {
  it('toggles several items with Space and arrows between them', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ToggleGroup
        multiple
        aria-label="Sources"
        defaultValue={['line', 'slack', 'photo']}
        onValueChange={onValueChange}
      >
        <ToggleGroupItem value="line">LINE</ToggleGroupItem>
        <ToggleGroupItem value="slack">Slack</ToggleGroupItem>
        <ToggleGroupItem value="photo">照片</ToggleGroupItem>
      </ToggleGroup>,
    );
    const line = screen.getByRole('button', { name: 'LINE' });
    expect(line.getAttribute('aria-pressed')).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(line);
    await user.keyboard('{ArrowRight}');
    const slack = screen.getByRole('button', { name: 'Slack' });
    expect(document.activeElement).toBe(slack);
    await user.keyboard(' ');
    expect(slack.getAttribute('aria-pressed')).toBe('false');
    expect(onValueChange).toHaveBeenLastCalledWith(
      ['line', 'photo'],
      expect.anything(),
    );
  });

  it('keeps a single pressed item without `multiple`', async () => {
    const user = userEvent.setup();
    render(
      <ToggleGroup defaultValue={['day']} variant="outline" size="sm">
        <ToggleGroupItem value="year">年</ToggleGroupItem>
        <ToggleGroupItem value="day">日</ToggleGroupItem>
      </ToggleGroup>,
    );
    const year = screen.getByRole('button', { name: '年' });
    await user.click(year);
    expect(year.getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getByRole('button', { name: '日' }).getAttribute('aria-pressed'),
    ).toBe('false');
    expect(year.className).toContain('border-input');
  });
});

describe('Checkbox', () => {
  it('toggles with Space and click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Checkbox aria-labelledby="slack-label" />
        <span id="slack-label">Slack</span>
      </div>,
    );
    const box = screen.getByRole('checkbox', { name: 'Slack' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    await user.tab();
    expect(document.activeElement).toBe(box);
    await user.keyboard(' ');
    expect(box.getAttribute('aria-checked')).toBe('true');
    await user.click(box);
    expect(box.getAttribute('aria-checked')).toBe('false');
  });

  it('takes its name from a wrapping label', async () => {
    const user = userEvent.setup();
    render(
      // eslint-disable-next-line jsx-a11y/label-has-associated-control -- Checkbox renders a hidden native input the rule cannot see through the component
      <label>
        <Checkbox />
        Slack
      </label>,
    );
    const box = screen.getByRole('checkbox', { name: 'Slack' });
    await user.click(screen.getByText('Slack'));
    expect(box.getAttribute('aria-checked')).toBe('true');
  });

  it('reports the indeterminate state', () => {
    render(<Checkbox aria-label="All sources" indeterminate />);
    expect(
      screen
        .getByRole('checkbox', { name: 'All sources' })
        .getAttribute('aria-checked'),
    ).toBe('mixed');
  });

  it('ignores input when disabled', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Photos" disabled />);
    const box = screen.getByRole('checkbox', { name: 'Photos' });
    await user.click(box);
    expect(box.getAttribute('aria-checked')).toBe('false');
  });
});

describe('static parts', () => {
  it('renders Kbd as <kbd> and groups a chord', () => {
    render(
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>,
    );
    expect(screen.getByText('K').tagName).toBe('KBD');
    expect(screen.getByText('K').parentElement?.dataset['slot']).toBe(
      'kbd-group',
    );
  });

  it('hides Skeleton from assistive tech', () => {
    const { container } = render(<Skeleton className="size-24" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('size-24');
  });

  it('exposes Separator orientation', () => {
    render(<Separator orientation="vertical" />);
    const sep = screen.getByRole('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    expect(sep.getAttribute('data-orientation')).toBe('vertical');
  });

  it('renders ScrollArea content inside a viewport', async () => {
    await act(async () => {
      render(
        <ScrollArea orientation="horizontal" className="w-64">
          <p>filmstrip</p>
        </ScrollArea>,
      );
    });
    const viewport = screen
      .getByText('filmstrip')
      .closest('[data-slot="scroll-area-viewport"]');
    expect(viewport).not.toBeNull();
  });
});
