export type HeadProps = {
  title: string;
  description?: string;
  imageUrl?: string;
};

export interface Props extends HeadProps {
  viewTransition?: {
    enabled: boolean;
  };
}
