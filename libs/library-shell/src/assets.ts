/**
 * Fonts, icons and the stylesheet every app shares, at one URL on the library hostname so the
 * browser downloads them once. The hall answers `/_shell` there; each app keeps the same files in
 * `public/_shell` for dev, e2e and its own port.
 */
export const SHELL_ASSET_BASE = '/_shell';

/**
 * The shared files. An app with a Next `basePath` keeps them in `public/_shell` too and
 * redirects `/_shell` to that copy off the library hostname.
 */
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
