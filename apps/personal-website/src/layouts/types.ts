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
}
