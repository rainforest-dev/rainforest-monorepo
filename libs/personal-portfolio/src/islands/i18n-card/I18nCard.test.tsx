import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { I18nCard } from './I18nCard';

describe('<I18nCard>', () => {
  it('mounts in English with a live swap-summary card', () => {
    render(<I18nCard />);
    expect(screen.getByText('Swap summary')).toBeDefined();
    expect(screen.getByText('You pay')).toBeDefined();
  });

  it('re-renders the card in Simplified Chinese when 简 is selected', () => {
    render(<I18nCard />);
    fireEvent.click(screen.getByRole('button', { name: '简' }));
    expect(screen.getByText('交易摘要')).toBeDefined();
    expect(screen.getByText('支付')).toBeDefined();
    expect(screen.queryByText('Swap summary')).toBeNull();
  });

  it('re-renders the card in Traditional Chinese when 繁 is selected', () => {
    render(<I18nCard />);
    fireEvent.click(screen.getByRole('button', { name: '繁' }));
    expect(screen.getByText('交易摘要')).toBeDefined();
    expect(screen.getByText('獲得')).toBeDefined();
  });
});
