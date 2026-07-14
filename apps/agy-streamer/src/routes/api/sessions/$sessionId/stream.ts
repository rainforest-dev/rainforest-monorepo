import { createFileRoute } from '@tanstack/react-router';

import { addSSEClient } from '@/lib/agent-manager';

export const Route = createFileRoute('/api/sessions/$sessionId/stream')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { sessionId } = params;
        let cleanup: (() => void) | null = null;

        const stream = new ReadableStream({
          start(controller) {
            cleanup = addSSEClient(sessionId, controller);
          },
          cancel() {
            if (cleanup) cleanup();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }
    }
  }
});
