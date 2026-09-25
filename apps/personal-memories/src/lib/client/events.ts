import type { LightboxRequest } from '../lightbox.ts';

export type AnnotateDetail = {
  eventId: string;
  at: string;
  source: string;
  author: string;
  excerpt: string;
};

export type LightboxDetail = LightboxRequest & { trigger: HTMLElement };

declare global {
  interface DocumentEventMap {
    'memories:day': CustomEvent<{ date: string }>;
    'memories:day-restored': CustomEvent<{ date: string }>;
    'memories:annotate': CustomEvent<AnnotateDetail>;
    'memories:lightbox': CustomEvent<LightboxDetail>;
  }
}
