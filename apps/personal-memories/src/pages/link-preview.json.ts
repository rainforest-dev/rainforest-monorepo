import type { APIRoute } from 'astro';

import { handleLinkPreview } from '@/lib/server';

export const GET: APIRoute = ({ url }) => handleLinkPreview(url);
