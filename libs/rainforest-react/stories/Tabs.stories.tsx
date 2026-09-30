import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../src';

const meta = {
  title: 'Navigation/Tabs',
  component: Tabs,
  args: { defaultValue: 'sources' },
  render: (args) => (
    <Tabs {...args} className="max-w-md">
      <TabsList>
        <TabsTrigger value="sources">Sources</TabsTrigger>
        <TabsTrigger value="topics">Topics</TabsTrigger>
        <TabsTrigger value="queue">Queue</TabsTrigger>
      </TabsList>
      <TabsContent value="sources">42 feeds across 7 categories.</TabsContent>
      <TabsContent value="topics">12 active topics.</TabsContent>
      <TabsContent value="queue">5 unread items.</TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Line: Story = {
  render: (args) => (
    <Tabs {...args} className="max-w-md">
      <TabsList variant="line">
        <TabsTrigger value="sources">Sources</TabsTrigger>
        <TabsTrigger value="topics">Topics</TabsTrigger>
        <TabsTrigger value="queue">Queue</TabsTrigger>
      </TabsList>
      <TabsContent value="sources">42 feeds across 7 categories.</TabsContent>
    </Tabs>
  ),
};

export const Dark: Story = { globals: { scheme: 'dark' } };
