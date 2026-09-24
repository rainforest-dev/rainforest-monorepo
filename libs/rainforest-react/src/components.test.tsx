import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Switch,
  toast,
  Toaster,
} from './index';

describe('Switch', () => {
  it('toggles aria-checked', () => {
    render(<Switch aria-label="Zap" />);
    const control = screen.getByRole('switch', { name: 'Zap' });
    expect(control.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(control);
    expect(control.getAttribute('aria-checked')).toBe('true');
  });
});

describe('Command', () => {
  it('filters items by the typed query', async () => {
    render(
      <Command>
        <CommandInput placeholder="Search author" />
        <CommandList>
          <CommandItem>Frank Herbert</CommandItem>
          <CommandItem>Isaac Asimov</CommandItem>
        </CommandList>
      </Command>,
    );
    fireEvent.change(screen.getByPlaceholderText('Search author'), {
      target: { value: 'herb' },
    });
    expect(await screen.findByText('Frank Herbert')).not.toBeNull();
    expect(screen.queryByText('Isaac Asimov')).toBeNull();
  });
});

describe('Dialog', () => {
  it('opens from its trigger', async () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Remove tag</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByText('Remove tag')).toBeNull();
    fireEvent.click(screen.getByText('Open'));
    expect(await screen.findByText('Remove tag')).not.toBeNull();
  });
});

describe('Toaster', () => {
  afterEach(() => {
    delete document.documentElement.dataset['scheme'];
  });

  it('follows a forced data-scheme on <html>', async () => {
    document.documentElement.dataset['scheme'] = 'dark';
    render(<Toaster />);
    await act(async () => {
      toast('Sent to Readwise');
    });
    const list = await waitFor(() => {
      const el = document.querySelector('[data-sonner-toaster]');
      if (!el) throw new Error('toaster not mounted');
      return el;
    });
    expect(list.getAttribute('data-sonner-theme')).toBe('dark');
  });
});
