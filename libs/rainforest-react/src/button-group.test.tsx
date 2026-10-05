import { render, screen } from '@testing-library/react';

import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from './index';

describe('ButtonGroup', () => {
  it('is a group that joins its children', () => {
    render(
      <ButtonGroup aria-label="Sort">
        <Button variant="outline">Title</Button>
        <Button variant="outline" aria-label="Sort direction: ascending">
          ↑
        </Button>
      </ButtonGroup>,
    );
    const group = screen.getByRole('group', { name: 'Sort' });
    expect(group.dataset['slot']).toBe('button-group');
    expect(group.className).toContain(
      '[&>[data-slot]~[data-slot]]:rounded-l-none',
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('stacks vertically', () => {
    render(
      <ButtonGroup aria-label="Zoom" orientation="vertical">
        <Button>+</Button>
        <Button>−</Button>
      </ButtonGroup>,
    );
    const group = screen.getByRole('group', { name: 'Zoom' });
    expect(group.dataset['orientation']).toBe('vertical');
    expect(group.className).toContain('flex-col');
  });

  it('renders its text part as another element through render', () => {
    render(
      <ButtonGroup aria-label="Query">
        <ButtonGroupText render={<span />}>https://</ButtonGroupText>
        <Button>Go</Button>
      </ButtonGroup>,
    );
    const text = screen.getByText('https://');
    expect(text.tagName).toBe('SPAN');
    expect(text.dataset['slot']).toBe('button-group-text');
  });

  it('draws a vertical separator between items', () => {
    render(
      <ButtonGroup aria-label="Clipboard">
        <Button>Copy</Button>
        <ButtonGroupSeparator />
        <Button>Paste</Button>
      </ButtonGroup>,
    );
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe(
      'vertical',
    );
  });
});
