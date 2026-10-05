import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUpIcon, DownloadIcon } from 'lucide-react';

import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../src';

const SORTS = [
  { value: 'title', label: 'Title' },
  { value: 'added', label: 'Date added' },
];

const meta = {
  title: 'Actions/ButtonGroup',
  component: ButtonGroup,
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SortControl: Story = {
  render: () => (
    <ButtonGroup>
      <Select items={SORTS} defaultValue="title">
        <SelectTrigger size="sm" aria-label="Sort">
          <span className="text-muted-foreground text-xs">Sort</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Sort direction: ascending"
      >
        <ArrowUpIcon aria-hidden />
      </Button>
    </ButtonGroup>
  ),
};

export const SelectAndAction: Story = {
  render: () => (
    <ButtonGroup>
      <Select items={[{ value: 'EPUB', label: 'EPUB' }]} defaultValue="EPUB">
        <SelectTrigger size="sm" aria-label="Download format">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="EPUB">EPUB</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm">
        <DownloadIcon aria-hidden />
        ZIP
      </Button>
    </ButtonGroup>
  ),
};

export const WithText: Story = {
  render: () => (
    <ButtonGroup className="w-80">
      <ButtonGroupText>https://</ButtonGroupText>
      <Input aria-label="Feed URL" placeholder="example.com/rss.xml" />
      <ButtonGroupSeparator />
      <Button variant="outline">Validate</Button>
    </ButtonGroup>
  ),
};

export const Dark: Story = {
  render: SortControl.render,
  globals: { scheme: 'dark' },
};
