import { createFileRoute } from '@tanstack/react-router';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const BRAIN_DIR = path.join(os.homedir(), '.gemini/antigravity-cli/brain');

export const Route = createFileRoute('/api/sessions/')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const items = await fs.readdir(BRAIN_DIR);
          const sessions = [];

          for (const item of items) {
            const itemPath = path.join(BRAIN_DIR, item);
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory() && item !== 'scratch' && item !== 'browser_recordings' && item !== 'html_artifacts') {
              const logPath = path.join(itemPath, '.system_generated/logs/transcript.jsonl');
              let mtime = stats.mtime;
              try {
                const logStats = await fs.stat(logPath);
                mtime = logStats.mtime;
              } catch (e) {
                // No log file yet, fall back to directory mtime
              }

              let title = 'New Session';
              try {
                const logContent = await fs.readFile(logPath, 'utf8');
                const lines = logContent.split('\n');
                for (const line of lines) {
                  if (!line.trim()) continue;
                  try {
                    const obj = JSON.parse(line);
                    if (obj.type === 'USER_INPUT' && obj.content) {
                      let text = obj.content
                        .replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '')
                        .replace(/<ADDITIONAL_METADATA>[\s\S]*<\/ADDITIONAL_METADATA>/g, '')
                        .replace(/<USER_SETTINGS_CHANGE>[\s\S]*<\/USER_SETTINGS_CHANGE>/g, '')
                        .trim();
                      if (text.length > 50) {
                        text = text.substring(0, 47) + '...';
                      }
                      title = text || title;
                      break;
                    }
                  } catch (err) {
                    // Skip malformed log line
                  }
                }
              } catch (e) {
                // No log file yet, keep default title
              }

              let agentType = 'agy';
              let directory = '';
              try {
                const metaContent = await fs.readFile(path.join(itemPath, 'metadata.json'), 'utf8');
                const meta = JSON.parse(metaContent);
                agentType = meta.agentType || 'agy';
                directory = meta.directory || '';
              } catch (e) {
                // No metadata file yet, use defaults
              }

              sessions.push({
                sessionId: item,
                lastModified: mtime.toISOString(),
                title,
                agentType,
                directory
              });
            }
          }

          sessions.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
          return new Response(JSON.stringify({ sessions }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ sessions: [] }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
