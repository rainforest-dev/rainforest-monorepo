import '../src/styles.css';

import type { Decorator, Preview } from '@storybook/react-vite';
import type * as React from 'react';
import { useEffect } from 'react';

function SchemeFrame({
  scheme,
  seed,
  children,
}: {
  scheme: 'light' | 'dark';
  seed: string | undefined;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset['scheme'] = scheme;
    if (seed) root.style.setProperty('--shadcn-seed-override', seed);
    else root.style.removeProperty('--shadcn-seed-override');
  }, [scheme, seed]);

  return (
    <div
      data-scheme={scheme}
      className="bg-background text-foreground min-h-24 p-6 font-sans"
      style={
        seed
          ? ({ '--shadcn-seed-override': seed } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}

const withScheme: Decorator = (Story, context) => (
  <SchemeFrame
    scheme={context.globals['scheme'] === 'dark' ? 'dark' : 'light'}
    seed={(context.globals['seed'] as string | undefined) || undefined}
  >
    <Story />
  </SchemeFrame>
);

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [withScheme],
  initialGlobals: {
    scheme: 'light',
    seed: '',
  },
  globalTypes: {
    scheme: {
      description: 'Colour scheme',
      toolbar: {
        title: 'Scheme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    seed: {
      description: 'Theme seed colour',
      toolbar: {
        title: 'Seed',
        icon: 'paintbrush',
        items: [
          { value: '', title: 'Default teal' },
          { value: '#7c5cff', title: 'Violet' },
          { value: '#e0784a', title: 'Amber' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: 'fullscreen',
  },
};

export default preview;
