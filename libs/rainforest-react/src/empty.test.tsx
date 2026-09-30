import { render, screen } from '@testing-library/react';
import { SearchXIcon } from 'lucide-react';

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './index';

describe('Empty', () => {
  it('lays out media, title, description and the next action in slots', () => {
    const { container } = render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No books match these filters.</EmptyTitle>
          <EmptyDescription>Try fewer filters.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>Clear filters</Button>
        </EmptyContent>
      </Empty>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset['slot']).toBe('empty');
    expect(
      screen.getByText('No books match these filters.').dataset['slot'],
    ).toBe('empty-title');
    const media = root.querySelector('[data-slot="empty-icon"]') as HTMLElement;
    expect(media.dataset['variant']).toBe('icon');
    expect(media.className).toContain('bg-muted');
    expect(
      screen
        .getByRole('button', { name: 'Clear filters' })
        .closest('[data-slot="empty-content"]'),
    ).not.toBeNull();
  });

  it('adds no role, so an error keeps using Alert', () => {
    const { container } = render(
      <Empty>
        <EmptyTitle>Nothing yet.</EmptyTitle>
      </Empty>,
    );
    expect(container.querySelector('[role]')).toBeNull();
  });
});
