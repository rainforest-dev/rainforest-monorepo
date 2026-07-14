import { createFileRoute } from '@tanstack/react-router';
import fs from 'fs/promises';
import path from 'path';

export const Route = createFileRoute('/api/browse/create')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          if (!body.path) {
            throw new Error('Path is required');
          }
          const targetPath = path.resolve(body.path);
          await fs.mkdir(targetPath, { recursive: true });
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
