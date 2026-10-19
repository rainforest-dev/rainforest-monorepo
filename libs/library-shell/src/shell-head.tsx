import { SHELL_ASSET_BASE, shellAssets } from './assets';
import { speculationRulesJson } from './speculation';

interface ShellHeadProps {
  /** Prerender collection pages on hover. Off for an app whose pages all write. */
  prerender?: boolean;
  /** Where this app serves `/_shell`; see `shellAssets`. */
  assetBase?: string;
}

/**
 * The shared `<head>` additions: the font preload and stylesheet from `/_shell`, and the
 * Speculation Rules. React 19 hoists the links into `<head>` wherever this renders.
 */
export function ShellHead({
  prerender = true,
  assetBase = SHELL_ASSET_BASE,
}: ShellHeadProps) {
  const assets = shellAssets(assetBase);
  return (
    <>
      <link
        rel="preload"
        href={assets.fonts[0]}
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <link rel="stylesheet" href={assets.stylesheet} precedence="default" />
      {prerender && (
        <script
          type="speculationrules"
          // Script text, not markup: React never executes it, the browser reads it as rules.
          dangerouslySetInnerHTML={{ __html: speculationRulesJson() }}
        />
      )}
    </>
  );
}
