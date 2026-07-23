import rss from '@astrojs/rss';
import { useTranslation } from '@utils';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Canonical English feed at the root `/rss.xml`, matching the Model B routing
// (English at the root; localised feeds live at /[lang]/rss.xml). This is what
// head.astro links to. Build-static, so prerender it as a CDN file.
export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const blog = await getCollection('blog');
  const { t } = await useTranslation('en', 'blog');
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
