import { z } from 'zod';

import { COLLECTION_IDS } from './collections';

/** The BroadcastChannel every app on the library hostname listens on. */
export const LIBRARY_CHANNEL = 'library';

/**
 * Cross-tab notices between apps. They carry no data, only what changed, so a listener
 * refetches through its own API.
 */
export const libraryMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('items-changed'),
    collection: z.enum(COLLECTION_IDS),
  }),
  z.object({ type: z.literal('prefs-changed') }),
]);
export type LibraryMessage = z.infer<typeof libraryMessageSchema>;
