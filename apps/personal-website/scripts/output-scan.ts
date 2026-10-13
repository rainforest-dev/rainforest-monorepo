import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

export const PRIVATE_HOST_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'ollama port', re: /:11434\b/ },
  { name: 'ollama embed route', re: /\/api\/embed\b/ },
  { name: 'ollama chat route', re: /\/api\/chat\b/ },
  { name: 'tailnet host', re: /\.ts\.net\b/ },
  {
    name: 'mDNS host',
    re: /(?:\/\/|@|["'`])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.local\b(?![.\w-])/i,
  },
  { name: 'RFC 1918 10/8', re: /\b10(?:\.\d{1,3}){3}\b/ },
  {
    name: 'RFC 1918 172.16/12',
    re: /\b172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}\b/,
  },
  { name: 'RFC 1918 192.168/16', re: /\b192\.168(?:\.\d{1,3}){2}\b/ },
];

const TEXT = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.html',
  '.json',
  '.css',
  '.txt',
  '.xml',
  '.webmanifest',
]);

export type OutputHit = { file: string; pattern: string; excerpt: string };

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (entry.isFile() && TEXT.has(extname(entry.name))) yield path;
  }
}

export function scanOutput(dir: string): OutputHit[] {
  const hits: OutputHit[] = [];
  for (const file of files(dir)) {
    const text = readFileSync(file, 'utf8');
    for (const { name, re } of PRIVATE_HOST_PATTERNS) {
      const match = re.exec(text);
      if (!match) continue;
      const at = match.index;
      hits.push({
        file: relative(dir, file),
        pattern: name,
        excerpt: text.slice(Math.max(0, at - 40), at + match[0].length + 40),
      });
    }
  }
  return hits;
}
