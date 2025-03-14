import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site, locals }) => {
  const blog = await getCollection('blogs');
  const { t } = locals;
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
