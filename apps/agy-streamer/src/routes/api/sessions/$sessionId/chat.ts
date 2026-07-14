import { createFileRoute } from '@tanstack/react-router';

import { startAgentSession } from '@/lib/agent-manager';

export const Route = createFileRoute('/api/sessions/$sessionId/chat')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { sessionId } = params;
        try {
          const { directory, prompt, agent } = await request.json();
          startAgentSession(sessionId, directory, prompt, agent || 'agy');
          return new Response(JSON.stringify({ success: true }), {
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
