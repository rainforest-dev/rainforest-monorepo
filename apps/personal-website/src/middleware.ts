import { defineMiddleware } from 'astro:middleware';

// Astro refuses to start with `i18n.routing: 'manual'` unless a middleware module exists.
export const onRequest = defineMiddleware((_context, next) => next());
