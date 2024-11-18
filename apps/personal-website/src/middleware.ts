import { persistentLocaleKey } from '@utils';
import { getRelativeLocaleUrl } from 'astro:i18n';
import { defineMiddleware } from 'astro:middleware';

const ROUTE_TYPE_HEADER = 'X-Astro-Route-Type' as const;

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const type = response.headers.get(ROUTE_TYPE_HEADER);
  if (type !== 'page') return response;
  const preferredLocale =
    context.cookies.get(persistentLocaleKey)?.value || context.preferredLocale;
  if (preferredLocale && preferredLocale !== context.currentLocale) {
    return context.redirect(
      getRelativeLocaleUrl(
        preferredLocale,
        context.url.pathname.replaceAll(`/${context.currentLocale}`, '')
      )
    );
  }
  return next();
});
