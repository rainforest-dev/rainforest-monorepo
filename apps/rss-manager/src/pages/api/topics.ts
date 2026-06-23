import type { APIRoute } from 'astro';
import { readTopics } from '../../lib/registry.js';

export const GET: APIRoute = () => {
  try {
    const topics = readTopics();
    return Response.json(topics);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
