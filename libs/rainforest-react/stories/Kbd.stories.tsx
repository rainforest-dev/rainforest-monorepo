import type { Meta, StoryObj } from '@storybook/react-vite';

import { Kbd, KbdGroup } from '../src';

const meta = {
  title: 'Display/Kbd',
  component: Kbd,
  args: { children: '/' },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Chord: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
};

export const ShortcutList: Story = {
  render: () => (
    <dl className="grid max-w-xs grid-cols-2 gap-y-2 text-sm">
      {[
        ['前一天 / 後一天', ['J', 'K']],
        ['跳至日期', ['/']],
        ['寫回憶', ['N']],
        ['鍵盤快速鍵', ['?']],
        ['關閉', ['Esc']],
      ].map(([label, keys]) => (
        <div key={label as string} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="flex justify-end gap-1">
            {(keys as string[]).map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  ),
};

export const Dark: Story = { globals: { scheme: 'dark' } };
