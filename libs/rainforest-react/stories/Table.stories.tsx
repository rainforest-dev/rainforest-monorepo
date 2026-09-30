import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Badge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../src';

const rows = [
  { name: 'Astro', category: 'Frontend & Web', status: 'active' },
  { name: "TkDodo's Blog", category: 'Proposed', status: 'proposed' },
  { name: 'Claude Code Changelog', category: 'No RSS', status: 'no-rss' },
] as const;

const statusVariant = {
  active: 'success',
  proposed: 'info',
  'no-rss': 'muted',
} as const;

const meta = {
  title: 'Display/Table',
  component: Table,
  render: (args) => (
    <Table {...args}>
      <TableCaption>RSS source registry</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.name}>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {r.category}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { globals: { scheme: 'dark' } };
