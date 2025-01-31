import '../src/lit/ai-button/index';

import type { Meta } from '@storybook/web-components';

import { RfAiButton } from '../src/lit/ai-button/index';

export default {
  title: 'AI Button',
  component: 'rf-ai-button',
} satisfies Meta<typeof RfAiButton>;

const Template = () => `<rf-ai-button>World</rf-ai-button>`;

export const Default = Template.bind({});
