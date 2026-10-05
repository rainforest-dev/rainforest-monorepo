import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckIcon, XIcon } from 'lucide-react';
import { Fragment } from 'react';

import {
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '../src';

const meta = {
  title: 'Display/Item',
  component: Item,
} satisfies Meta<typeof Item>;

export default meta;
type Story = StoryObj<typeof meta>;

const DELIVERIES = [
  { name: 'Kobo', added: '2026-09-01' },
  { name: 'NotebookLM', added: null },
  { name: 'Readwise Reader', added: null },
];

function DeliveryRow({ name, added }: (typeof DELIVERIES)[number]) {
  return (
    <Item role="listitem" className="rounded-none py-2">
      <ItemContent>
        <ItemTitle>
          {name}
          {added ? (
            <Badge variant="success">
              <CheckIcon aria-hidden />
              {added}
            </Badge>
          ) : (
            <Badge variant="muted">Not added</Badge>
          )}
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="xs">
          {added ? 'Log again' : 'Mark added'}
        </Button>
      </ItemActions>
    </Item>
  );
}

export const DeliveryRows: Story = {
  render: () => (
    <ItemGroup className="w-96 gap-0 rounded-lg border">
      {DELIVERIES.map((delivery) => (
        <Fragment key={delivery.name}>
          <ItemSeparator />
          <DeliveryRow {...delivery} />
        </Fragment>
      ))}
    </ItemGroup>
  ),
};

export const WrappedRows: Story = {
  render: () => (
    <ItemGroup className="w-96 gap-0 rounded-lg border">
      {DELIVERIES.map((delivery) => (
        <div key={delivery.name} className="contents">
          <ItemSeparator />
          <DeliveryRow {...delivery} />
        </div>
      ))}
    </ItemGroup>
  ),
};

export const HistoryEntry: Story = {
  render: () => (
    <ItemGroup className="w-96 gap-2">
      <Item
        role="listitem"
        variant="outline"
        className="items-start px-2.5 py-2"
      >
        <ItemContent className="min-w-0">
          <ItemTitle>
            Kobo
            <span className="text-muted-foreground font-mono text-xs font-normal">
              2026-09-01 09:30
            </span>
          </ItemTitle>
          <ItemDescription>first read</ItemDescription>
          <ItemDescription className="truncate">
            <a href="https://shelf.example.com/41">
              https://shelf.example.com/41
            </a>
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="ghost" size="icon-xs" aria-label="Remove Kobo event">
            <XIcon aria-hidden />
          </Button>
        </ItemActions>
      </Item>
    </ItemGroup>
  ),
};

export const AsLink: Story = {
  render: () => (
    <Item
      variant="outline"
      className="w-96"
      // eslint-disable-next-line jsx-a11y/anchor-has-content -- useRender fills the anchor with Item's children, which the rule cannot see through
      render={<a href="#harbor-lights" />}
    >
      <ItemContent>
        <ItemTitle>Harbor Lights</ItemTitle>
        <ItemDescription>Mira Okafor · EPUB</ItemDescription>
      </ItemContent>
    </Item>
  ),
};

export const Dark: Story = {
  render: DeliveryRows.render,
  globals: { scheme: 'dark' },
};
