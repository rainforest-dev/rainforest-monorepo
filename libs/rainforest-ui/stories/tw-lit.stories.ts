import '../src/lit/tw-lit/index';

import type { Meta } from '@storybook/web-components';

import type { RfTwLit } from '../src/lit/tw-lit/index';

export default {
  title: 'TW Lit',
  component: 'rf-tw-lit',
} satisfies Meta<RfTwLit>;

const Template = () => `<rf-tw-lit>TW Lit</rf-tw-lit>`;

export const Default = Template.bind({});
