import type { Meta, StoryObj } from '@storybook/react-vite';

import { KeyHints } from '../src';

const meta = {
  title: 'Display/KeyHints',
  component: KeyHints,
  args: {
    hints: [
      { keys: ['/'], label: 'Search' },
      { keys: ['v'], label: 'Switch view' },
      { keys: ['←↑↓→'], label: 'Move' },
      { keys: ['Home', 'End'], label: 'Row ends' },
      { keys: ['[', ']'], label: 'Page' },
      { keys: ['Enter'], label: 'Open' },
      { keys: ['x'], label: 'Select' },
      { keys: ['Esc'], label: 'Close, then clear' },
    ],
  },
} satisfies Meta<typeof KeyHints>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { globals: { scheme: 'dark' } };
