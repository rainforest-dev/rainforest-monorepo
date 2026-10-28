import { SHELL_ASSETS } from './assets';
import { sidebarScript } from './layout';
import { speculationRulesJson } from './speculation';

interface ShellHeadProps {
  /** Prerender collection pages on hover. Off for an app whose pages all write. */
  prerender?: boolean;
}

/**
 * The shared `<head>` additions: the font preload and stylesheet from `/_shell`, the script
 * that closes the left column before paint when the reader closed it, and the Speculation
 * Rules. The `<html>` element needs `suppressHydrationWarning` for that script's attribute. React 19 hoists the links into `<head>` wherever this renders.
 */
export function ShellHead({ prerender = true }: ShellHeadProps) {
  const assets = SHELL_ASSETS;
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
      <script dangerouslySetInnerHTML={{ __html: sidebarScript() }} />
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
