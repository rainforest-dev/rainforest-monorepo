import type { APIRoute } from 'astro';

import {
  duplicateNameWarnings,
  handleRegistryPatch,
  isWritable,
  readTopics,
  TOPICS_FILE,
  TOPICS_PATCH,
} from '@/server';

export const GET: APIRoute = () => {
  try {
    const topics = readTopics();
    return Response.json({
      topics,
      writable: isWritable(TOPICS_FILE),
      warnings: duplicateNameWarnings(topics),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const PATCH: APIRoute = ({ request }) =>
  handleRegistryPatch(request, TOPICS_PATCH);
