import { render, screen } from '@testing-library/react';

import {
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from './index';

describe('Item', () => {
  it('forms a list when each item takes role listitem', () => {
    render(
      <ItemGroup aria-label="Deliveries">
        <Item role="listitem" data-platform="kobo">
          <ItemContent>
            <ItemTitle>
              Kobo
              <Badge variant="muted">Not added</Badge>
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <Button size="xs">Mark added</Button>
          </ItemActions>
        </Item>
        <Item role="listitem" size="sm" data-platform="notebooklm">
          <ItemContent>
            <ItemTitle>NotebookLM</ItemTitle>
          </ItemContent>
        </Item>
      </ItemGroup>,
    );
    const list = screen.getByRole('list', { name: 'Deliveries' });
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.dataset['slot']).toBe('item');
    expect(rows[0]?.dataset['size']).toBe('default');
    expect(rows[1]?.dataset['size']).toBe('sm');
    expect(
      list.contains(screen.getByRole('button', { name: 'Mark added' })),
    ).toBe(true);
  });

  it('renders as a link through render and keeps its variant', () => {
    render(
      // eslint-disable-next-line jsx-a11y/anchor-has-content -- useRender fills the anchor with Item's children, which the rule cannot see through
      <Item variant="outline" render={<a href="/books/38" />}>
        <ItemContent>
          <ItemTitle>Harbor Lights</ItemTitle>
          <ItemDescription>Mira Okafor</ItemDescription>
        </ItemContent>
      </Item>,
    );
    const link = screen.getByRole('link', { name: /Harbor Lights/ });
    expect(link.getAttribute('href')).toBe('/books/38');
    expect(link.dataset['variant']).toBe('outline');
    expect(link.className).toContain('border-border');
    expect(screen.getByText('Mira Okafor').tagName).toBe('P');
  });

  it('marks image media', () => {
    const { container } = render(
      <Item>
        <ItemMedia variant="image">
          <img src="/cover.jpg" alt="" />
        </ItemMedia>
      </Item>,
    );
    expect(
      container
        .querySelector('[data-slot="item-media"]')
        ?.getAttribute('data-variant'),
    ).toBe('image');
  });
});
