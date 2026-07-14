import { createFileRoute } from '@tanstack/react-router';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export const Route = createFileRoute('/api/browse')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const target = url.searchParams.get('path') || os.homedir();
          const targetPath = path.resolve(target);
          
          const files = await fs.readdir(targetPath, { withFileTypes: true });
          const directories = files
            .filter(item => item.isDirectory() && !item.name.startsWith('.'))
            .map(item => item.name)
            .sort();

          return new Response(JSON.stringify({
            currentPath: targetPath,
            parentPath: path.dirname(targetPath),
            directories
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({
            currentPath: os.homedir(),
            parentPath: os.homedir(),
            directories: [],
            error: (e as Error).message
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
