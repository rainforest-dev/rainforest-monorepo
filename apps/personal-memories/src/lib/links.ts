export * from '@rainforest-dev/journal-kit';

export function previewUrl(href: string): string {
  return `/link-preview.json?url=${encodeURIComponent(href)}`;
}

export const LINK_CLASS =
  'text-primary underline underline-offset-2 hover:decoration-2';
