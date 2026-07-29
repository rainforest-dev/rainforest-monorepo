import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PhraseGrid } from './PhraseGrid';

describe('<PhraseGrid>', () => {
  it('mounts and renders 12 word cells', () => {
    render(<PhraseGrid />);
    expect(screen.getAllByRole('textbox')).toHaveLength(12);
  });
});
