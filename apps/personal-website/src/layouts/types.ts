export type HeadProps = {
  title: string;
  description?: string;
  imageUrl?: string;
};

export interface Props extends HeadProps {
  viewTransition?: {
    enabled: boolean;
  };
  /**
   * Hide the floating SourceColor picker rendered by this layout.
   * Used by pages whose content already fills the viewport (e.g. the
   * scaled print-preview resume page), where the fixed picker would
   * otherwise sit on top of page content with no way to scroll clear.
   */
  hideSourceColorPicker?: boolean;
  /**
   * Wrap the page in the shared site chrome — a global sticky header (primary
   * nav + language switch) and a footer. Off by default; content pages
   * (portfolio, blog, posts, resume, future pages) opt in. The home page keeps
   * its bespoke hero nav instead of this shell.
   */
  shell?: boolean;
}
