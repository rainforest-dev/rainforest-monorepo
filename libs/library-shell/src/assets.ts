/**
 * Fonts, icons and the stylesheet every app shares, at one URL on the library hostname so the
 * browser downloads them once. Each app serves the same files from `public/_shell` until the
 * hall owns the path.
 */
export const SHELL_ASSET_BASE = '/_shell';

export const SHELL_ASSETS = {
  stylesheet: `${SHELL_ASSET_BASE}/shell.css`,
  fonts: [
    `${SHELL_ASSET_BASE}/fonts/inter-latin-wght-normal.woff2`,
    `${SHELL_ASSET_BASE}/fonts/inter-latin-ext-wght-normal.woff2`,
  ],
  icon: `${SHELL_ASSET_BASE}/icons/library.svg`,
} as const;

/** The font-family the shared stylesheet registers. */
export const SHELL_FONT_FAMILY = 'Inter Variable';
