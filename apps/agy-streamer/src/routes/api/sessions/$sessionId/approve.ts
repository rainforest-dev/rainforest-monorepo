import { createFileRoute } from '@tanstack/react-router';

import { handleToolApproval } from '@/lib/agent-manager';

export const Route = createFileRoute('/api/sessions/$sessionId/approve')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { sessionId } = params;
        try {
          const { optionIndex } = await request.json();
          const success = handleToolApproval(sessionId, optionIndex);
          return new Response(JSON.stringify({ success }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
