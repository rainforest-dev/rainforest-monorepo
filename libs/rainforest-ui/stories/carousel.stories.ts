import '../src/lit/carousel/index';

import type { Meta } from '@storybook/web-components';

import { RfCarousel } from '../src/lit/carousel/index';

export default {
  title: 'Carousel',
  component: 'rf-carousel',
} satisfies Meta<typeof RfCarousel>;

const images = [
  'https://images.unsplash.com/photo-1739403386250-080677ac4c53?q=80&w=3090&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1738584672973-f33b662c05d4?q=80&w=3003&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1739179418323-2d9517032c6f?q=80&w=3087&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1736604860264-e2f21df57a89?q=80&w=2487&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1739381337633-4c0191288570?q=80&w=2487&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1738682081595-7bac257f60cd?q=80&w=2487&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
];

const Template = () =>
  `<div style="height: 300px; width: 800px; border: 1px solid black; overflow: hidden;"><rf-carousel images=${JSON.stringify(
    images
  )}></rf-carousel></div>`;

export const Default = Template.bind({});
