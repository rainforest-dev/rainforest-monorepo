import type { LightboxRequest } from '../lightbox.ts';

export type AnnotateDetail = {
  eventId: string;
  at: string;
  source: string;
  author: string;
  excerpt: string;
};

export type LongPressDetail = {
  x: number;
  y: number;
  anchor: AnnotateDetail;
  text: string;
};

export type LightboxDetail = LightboxRequest & { trigger: HTMLElement };

declare global {
  interface DocumentEventMap {
    'memories:day': CustomEvent<{ date: string }>;
    'memories:day-restored': CustomEvent<{ date: string }>;
    'memories:annotate': CustomEvent<AnnotateDetail>;
    'memories:longpress': CustomEvent<LongPressDetail>;
    'memories:lightbox': CustomEvent<LightboxDetail>;
    'memories:open-jump': CustomEvent<undefined>;
    'memories:open-shortcuts': CustomEvent<undefined>;
    'memories:focus-note': CustomEvent<undefined>;
  }
}
