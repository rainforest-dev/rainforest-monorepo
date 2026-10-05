import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { Fragment } from 'react';

import {
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
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

const shippedCss = readFileSync(
  join(__dirname, '..', 'dist', 'styles.css'),
  'utf8',
);

interface Rule {
  utility: string;
  selector: string;
}

const LEADING_CLASS = /^\.((?:\\.|[^\s>+~.:[\\])+)/;

// jsdom's selector engine cannot match Tailwind's escaped arbitrary-variant class names.
function rulesFor(declaration: string): Rule[] {
  return [...shippedCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(
      ([, selector, body]) =>
        selector?.includes('item-separator') && body?.includes(declaration),
    )
    .flatMap(([, selector]) => selector?.split(/,(?=\.)/) ?? [])
    .map((selector) => {
      const escaped = LEADING_CLASS.exec(selector)?.[1] ?? '';
      return {
        utility: escaped.replace(/\\(.)/g, '$1'),
        selector: `[data-slot=item-group]${selector.slice(escaped.length + 1)}`,
      };
    });
}

const appliedBy = (rules: Rule[]) => (el: Element) =>
  rules.some(
    ({ utility, selector }) =>
      el.closest('[data-slot=item-group]')?.classList.contains(utility) &&
      el.matches(selector),
  );

const hiddenBy = rulesFor('display:none');
const flushBy = rulesFor('margin-top:-1px');
const isHidden = appliedBy(hiddenBy);
const isFlush = appliedBy(flushBy);

const separators = (container: HTMLElement) => [
  ...container.querySelectorAll('[data-slot="item-separator"]'),
];

function Row({ name }: { name: string }) {
  return (
    <Item role="listitem">
      <ItemContent>
        <ItemTitle>{name}</ItemTitle>
      </ItemContent>
    </Item>
  );
}

const NAMES = ['Kobo', 'NotebookLM', 'Readwise Reader'];

describe('ItemSeparator edges', () => {
  it('ships the edge rules in dist/styles.css', () => {
    expect(hiddenBy.length).toBeGreaterThanOrEqual(5);
    expect(flushBy.length).toBeGreaterThanOrEqual(2);
  });

  it('hides a leading separator rendered before each item', () => {
    const { container } = render(
      <ItemGroup>
        {NAMES.map((name) => (
          <Fragment key={name}>
            <ItemSeparator />
            <Row name={name} />
          </Fragment>
        ))}
      </ItemGroup>,
    );
    expect(separators(container).map(isHidden)).toEqual([true, false, false]);
  });

  it('hides a trailing separator rendered after each item', () => {
    const { container } = render(
      <ItemGroup>
        {NAMES.map((name) => (
          <Fragment key={name}>
            <Row name={name} />
            <ItemSeparator />
          </Fragment>
        ))}
      </ItemGroup>,
    );
    expect(separators(container).map(isHidden)).toEqual([false, false, true]);
  });

  it('hides the edges when each item sits in a display:contents wrapper', () => {
    const before = render(
      <ItemGroup>
        {NAMES.map((name) => (
          <div key={name} className="contents">
            <ItemSeparator />
            <Row name={name} />
          </div>
        ))}
      </ItemGroup>,
    );
    expect(separators(before.container).map(isHidden)).toEqual([
      true,
      false,
      false,
    ]);
    const after = render(
      <ItemGroup>
        {NAMES.map((name) => (
          <div key={name} className="contents">
            <Row name={name} />
            <ItemSeparator />
          </div>
        ))}
      </ItemGroup>,
    );
    expect(separators(after.container).map(isHidden)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('draws one line where two separators meet', () => {
    const { container } = render(
      <ItemGroup>
        <Row name="Kobo" />
        <ItemSeparator />
        <ItemSeparator />
        <Row name="NotebookLM" />
      </ItemGroup>,
    );
    expect(separators(container).map(isHidden)).toEqual([false, true]);
  });

  it('sits flush only in a gap-0 group', () => {
    const { container } = render(
      <>
        <ItemGroup className="gap-0 rounded-lg border">
          <Row name="Kobo" />
          <ItemSeparator />
          <Row name="NotebookLM" />
        </ItemGroup>
        <ItemGroup>
          <Row name="Kobo" />
          <ItemSeparator />
          <Row name="NotebookLM" />
        </ItemGroup>
        <ItemGroup className="gap-0">
          <div className="contents">
            <Row name="Kobo" />
          </div>
          <div className="contents">
            <ItemSeparator />
            <Row name="NotebookLM" />
          </div>
        </ItemGroup>
      </>,
    );
    expect(separators(container).map(isFlush)).toEqual([true, false, true]);
  });

  it('keeps the separator out of the list semantics', () => {
    render(
      <ItemGroup aria-label="Deliveries">
        <Row name="Kobo" />
        <ItemSeparator />
        <Row name="NotebookLM" />
      </ItemGroup>,
    );
    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
