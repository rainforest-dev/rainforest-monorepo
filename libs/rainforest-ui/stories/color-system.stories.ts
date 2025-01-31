import '../src/lit/design-system/colors';
import '../src/lit/design-system/typography';

import type { Meta } from '@storybook/web-components';

export default {
  title: 'Color System',
} satisfies Meta;

export const Colors = {
  render() {
    return `<rf-design-system-colors></rf-design-system-colors>`;
  },
};

export const Typography = {
  render() {
    return `<rf-design-system-typography></rf-design-system-typography>`;
  },
};
