import rss from '@astrojs/rss';
import { useTranslation } from '@utils';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site, params: { lang = 'en' } }) => {
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
