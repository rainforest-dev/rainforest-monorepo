import '../src/lit/ai-button/index';

import type { Meta, StoryObj } from '@storybook/web-components';

import { AiButton } from '../src/lit/ai-button/index';

export default {
  title: 'AI Button',
  component: 'rf-ai-button',
} satisfies Meta<typeof AiButton>;

const Template = () => `<rf-ai-button></rf-ai-button>`;

export const Default = Template.bind({});
