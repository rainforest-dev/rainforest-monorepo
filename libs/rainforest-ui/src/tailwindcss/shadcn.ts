import plugin from 'tailwindcss/plugin';

interface IOptions {
  sourceColor?: string;
}

const LIGHT_VARS = `
  --seed: var(--shadcn-seed-override, SOURCE_COLOR);
  --background: oklch(from var(--seed) 0.98 0.012 h);
  --foreground: oklch(from var(--seed) 0.19 0.02 h);
  --card: oklch(from var(--seed) 0.995 0.008 h);
  --card-foreground: oklch(from var(--seed) 0.19 0.02 h);
  --popover: oklch(from var(--seed) 0.995 0.008 h);
  --popover-foreground: oklch(from var(--seed) 0.19 0.02 h);
  --primary: oklch(from var(--seed) 0.55 0.12 h);
  --primary-foreground: oklch(from var(--seed) 0.98 0.012 h);
  --secondary: oklch(from var(--seed) 0.94 0.02 h);
  --secondary-foreground: oklch(from var(--seed) 0.25 0.03 h);
  --muted: oklch(from var(--seed) 0.94 0.015 h);
  --muted-foreground: oklch(from var(--seed) 0.48 0.02 h);
  --accent: oklch(from var(--seed) 0.9 0.035 h);
  --accent-foreground: oklch(from var(--seed) 0.25 0.03 h);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.98 0.01 27.325);
  --border: oklch(from var(--seed) 0.88 0.015 h);
  --input: oklch(from var(--seed) 0.88 0.015 h);
  --ring: oklch(from var(--seed) 0.55 0.12 h);
`;

const DARK_VARS = `
  --background: oklch(from var(--seed) 0.17 0.02 h);
  --foreground: oklch(from var(--seed) 0.93 0.015 h);
  --card: oklch(from var(--seed) 0.21 0.02 h);
  --card-foreground: oklch(from var(--seed) 0.93 0.015 h);
  --popover: oklch(from var(--seed) 0.21 0.02 h);
  --popover-foreground: oklch(from var(--seed) 0.93 0.015 h);
  --primary: oklch(from var(--seed) 0.75 0.11 h);
  --primary-foreground: oklch(from var(--seed) 0.17 0.02 h);
  --secondary: oklch(from var(--seed) 0.27 0.02 h);
  --secondary-foreground: oklch(from var(--seed) 0.93 0.015 h);
  --muted: oklch(from var(--seed) 0.27 0.02 h);
  --muted-foreground: oklch(from var(--seed) 0.65 0.02 h);
  --accent: oklch(from var(--seed) 0.32 0.035 h);
  --accent-foreground: oklch(from var(--seed) 0.93 0.015 h);
  --destructive: oklch(0.55 0.2 27.325);
  --destructive-foreground: oklch(0.98 0.01 27.325);
  --border: oklch(from var(--seed) 0.32 0.02 h);
  --input: oklch(from var(--seed) 0.32 0.02 h);
  --ring: oklch(from var(--seed) 0.75 0.11 h);
`;

// Static fallback for engines without relative-color-syntax support (pre-Safari 26),
// pre-resolved from the default teal seed (#66b2b2).
const FALLBACK_LIGHT = `
  --seed: #66b2b2;
  --background: #f7fafa; --foreground: #1c2b2b; --card: #fdffff; --card-foreground: #1c2b2b;
  --popover: #fdffff; --popover-foreground: #1c2b2b; --primary: #3e7d7d; --primary-foreground: #f7fafa;
  --secondary: #e2f0ef; --secondary-foreground: #23403f; --muted: #e4f1f0; --muted-foreground: #5c7877;
  --accent: #cfe8e6; --accent-foreground: #23403f; --destructive: #c0362d; --destructive-foreground: #fdf2f1;
  --border: #d2e3e2; --input: #d2e3e2; --ring: #3e7d7d;
`;
const FALLBACK_DARK = `
  --background: #182626; --foreground: #e8f2f1; --card: #1e3030; --card-foreground: #e8f2f1;
  --popover: #1e3030; --popover-foreground: #e8f2f1; --primary: #8fc9c8; --primary-foreground: #182626;
  --secondary: #2c4443; --secondary-foreground: #e8f2f1; --muted: #2c4443; --muted-foreground: #a7bdbc;
  --accent: #35504f; --accent-foreground: #e8f2f1; --destructive: #c4544a; --destructive-foreground: #fdf2f1;
  --border: #35504f; --input: #35504f; --ring: #8fc9c8;
`;

export default plugin.withOptions(
  ({ sourceColor = '#66b2b2' }: IOptions = {}) => {
    return ({ addBase }) => {
      addBase({
        ':root': LIGHT_VARS.replace(
          'SOURCE_COLOR',
          sourceColor,
        ) as unknown as Record<string, string>,
      });
      addBase({
        '@media (prefers-color-scheme: dark)': {
          ':root': DARK_VARS as unknown as Record<string, string>,
        },
      });
      addBase({
        "[data-scheme='light']": LIGHT_VARS.replace(
          'SOURCE_COLOR',
          sourceColor,
        ) as unknown as Record<string, string>,
      });
      addBase({
        "[data-scheme='dark']": DARK_VARS as unknown as Record<string, string>,
      });
      addBase({
        '@supports not (color: oklch(from red l c h))': {
          ':root': FALLBACK_LIGHT as unknown as Record<string, string>,
          '@media (prefers-color-scheme: dark)': {
            ':root': FALLBACK_DARK as unknown as Record<string, string>,
          },
          "[data-scheme='light']": FALLBACK_LIGHT as unknown as Record<
            string,
            string
          >,
          "[data-scheme='dark']": FALLBACK_DARK as unknown as Record<
            string,
            string
          >,
        },
      });
    };
  },
  () => ({
    theme: {
      extend: {
        colors: {
          background: 'var(--background)',
          foreground: 'var(--foreground)',
          card: 'var(--card)',
          'card-foreground': 'var(--card-foreground)',
          popover: 'var(--popover)',
          'popover-foreground': 'var(--popover-foreground)',
          primary: 'var(--primary)',
          'primary-foreground': 'var(--primary-foreground)',
          secondary: 'var(--secondary)',
          'secondary-foreground': 'var(--secondary-foreground)',
          muted: 'var(--muted)',
          'muted-foreground': 'var(--muted-foreground)',
          accent: 'var(--accent)',
          'accent-foreground': 'var(--accent-foreground)',
          destructive: 'var(--destructive)',
          'destructive-foreground': 'var(--destructive-foreground)',
          border: 'var(--border)',
          input: 'var(--input)',
          ring: 'var(--ring)',
        },
        borderRadius: {
          sm: 'calc(var(--radius) - 4px)',
          md: 'calc(var(--radius) - 2px)',
          lg: 'var(--radius)',
          xl: 'calc(var(--radius) + 4px)',
        },
      },
    },
  }),
);
