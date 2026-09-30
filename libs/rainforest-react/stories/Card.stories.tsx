import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../src';

const meta = {
  title: 'Display/Card',
  component: Card,
  argTypes: {
    size: { control: 'select', options: ['default', 'sm'] },
  },
  render: (args) => (
    <Card {...args} className="max-w-sm">
      <CardHeader>
        <CardTitle>Dune</CardTitle>
        <CardDescription>Frank Herbert · Dune Chronicles #1</CardDescription>
        <CardAction>
          <Badge variant="outline">EPUB</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        A desert planet, a noble family and the spice that holds an empire
        together.
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Read</Button>
        <Button size="sm" variant="outline">
          Send to Kindle
        </Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: 'sm' } };

export const Dark: Story = { globals: { scheme: 'dark' } };
