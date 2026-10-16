import { handleLinkPreview } from '@rainforest-dev/journal-kit/server';

/**
 * Title, description and image of a web page a notebook page links to, for its preview card. The
 * fetch is guarded against private addresses and redirects into them, the same as Memories'.
 */
export function GET(request: Request) {
  return handleLinkPreview(new URL(request.url));
}
