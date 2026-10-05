import { defineMiddleware } from 'astro:middleware';

import { getNoteVectors } from '@/lib/server';

export const onRequest = defineMiddleware((_context, next) => {
  getNoteVectors().syncIfStale(Date.now());
  return next();
});
