import { SHELL_ASSETS } from './assets';
import { speculationRulesJson } from './speculation';

interface ShellHeadProps {
  /** Prerender collection pages on hover. Off for an app whose pages all write. */
  prerender?: boolean;
}

/**
 * The shared `<head>` additions: the font preload and stylesheet from `/_shell`, and the
 * Speculation Rules. React 19 hoists the links into `<head>` wherever this renders.
 */
export function ShellHead({ prerender = true }: ShellHeadProps) {
  return (
    <>
      <link
        rel="preload"
        href={SHELL_ASSETS.fonts[0]}
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href={SHELL_ASSETS.stylesheet}
        precedence="default"
      />
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
