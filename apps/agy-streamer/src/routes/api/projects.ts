import { createFileRoute } from '@tanstack/react-router';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const PROJECTS_DIR = path.join(os.homedir(), '.gemini/config/projects');

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const files = await fs.readdir(PROJECTS_DIR);
          const projects = [];

          for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
              const content = await fs.readFile(path.join(PROJECTS_DIR, file), 'utf8');
              const data = JSON.parse(content);
              const resources = data.projectResources?.resources || [];
              let folderPath = '';
              for (const res of resources) {
                if (res.gitFolder?.folderUri) {
                  const uri = res.gitFolder.folderUri;
                  if (uri.startsWith('file://')) {
                    folderPath = uri.substring(7);
                  }
                  break;
                }
              }
              if (data.name && folderPath) {
                projects.push({
                  id: data.id || file.replace('.json', ''),
                  name: data.name,
                  path: folderPath
                });
              }
            } catch (e) {}
          }
          return new Response(JSON.stringify(projects), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err) {
          return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
