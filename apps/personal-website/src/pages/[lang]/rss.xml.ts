import rss from '@astrojs/rss';
import { useTranslation } from '@utils';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site, params: { lang = 'en' }, cache }) => {
  // Astro 7 route caching: the feed only changes when blog content changes (on
  // deploy), so push it to Vercel's edge and serve cache hits from the CDN
  // instead of re-rendering per request. No AI-crawler tracking runs here, so
  // there's no fidelity trade-off. (No-op in dev / when no cache provider.)
  if (cache.enabled) cache.set({ maxAge: 3600, swr: 86400 });
  const blog = await getCollection('blog');
  const { t } = await useTranslation(lang, 'blog');
  return rss({
    title: t('metadata-title'),
    description: t('metadata-description'),
    site: site!,
    items: blog.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}`,
    })),
  });
};
