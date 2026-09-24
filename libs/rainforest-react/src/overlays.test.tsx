import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './index';

describe('Tabs', () => {
  it('passes a vertical orientation to the tablist and arrows down between tabs', async () => {
    render(
      <Tabs defaultValue="sources" orientation="vertical">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
        </TabsList>
        <TabsContent value="sources">Sources panel</TabsContent>
        <TabsContent value="topics">Topics panel</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe(
      'vertical',
    );
    const first = screen.getByRole('tab', { name: 'Sources' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('tab', { name: 'Topics' }),
      ),
    );
  });
});

describe('Dialog', () => {
  it('closes and returns focus to its trigger', async () => {
    render(
      <Dialog>
        <DialogTrigger>Remove tag</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Remove “fantasy”?</DialogTitle>
          <DialogClose>Cancel</DialogClose>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole('button', { name: 'Remove tag' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByText('Remove “fantasy”?')).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('Select', () => {
  it('picks a value, closes and returns focus to its trigger', async () => {
    const items = [
      { value: 'title', label: 'Title' },
      { value: 'author', label: 'Author' },
    ];
    render(
      <Select defaultValue="title" items={items}>
        <SelectTrigger aria-label="Sort by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole('combobox', { name: 'Sort by' });
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Author' }));
    await waitFor(() =>
      expect(trigger.getAttribute('aria-expanded')).toBe('false'),
    );
    expect(trigger.textContent).toContain('Author');
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
