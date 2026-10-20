/**
 * Fonts, icons and the stylesheet every app shares, at one URL on the library hostname so the
 * browser downloads them once. Each app serves the same files from `public/_shell` until the
 * hall owns the path.
 */
export const SHELL_ASSET_BASE = '/_shell';

/**
 * The shared files under `base`. An app with a Next `basePath` serves `public/_shell` under that
 * path, so until the hostname routes `/_shell` it passes its own (`/notebooks/_shell`). The
 * stylesheet names its fonts relative to itself, so they follow.
 */
export function shellAssets(base: string = SHELL_ASSET_BASE) {
  return {
    stylesheet: `${base}/shell.css`,
    fonts: [
      `${base}/fonts/inter-latin-wght-normal.woff2`,
      `${base}/fonts/inter-latin-ext-wght-normal.woff2`,
    ],
    icon: `${base}/icons/library.svg`,
  } as const;
}

export const SHELL_ASSETS = shellAssets();

/** The font-family the shared stylesheet registers. */
export const SHELL_FONT_FAMILY = 'Inter Variable';
