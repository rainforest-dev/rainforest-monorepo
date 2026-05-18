import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const MIME_TYPES: Record<string, string> = {
  epub: 'application/epub+zip',
  pdf: 'application/pdf',
  mobi: 'application/x-mobipocket-ebook',
  azw: 'application/vnd.amazon.ebook',
  azw3: 'application/vnd.amazon.ebook',
  txt: 'text/plain',
  rtf: 'application/rtf',
  djvu: 'image/vnd.djvu',
  cbz: 'application/vnd.comicbook+zip',
  cbr: 'application/vnd.comicbook-rar',
};

// Retries EAGAIN (errno -35) from Synology VirtioFS: first read triggers the
// FileProvider to download an online-only file; subsequent reads succeed.
export async function readWithRetry(filePath: string, attempts = 5): Promise<Buffer> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await readFile(filePath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const errno = (err as NodeJS.ErrnoException).errno;
      if ((code === 'EAGAIN' || errno === -35) && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}

export function resolveFilePath(libraryPath: string, bookPath: string, name: string, format: string): string {
  return path.join(libraryPath, bookPath, `${name}.${format.toLowerCase()}`);
}

export function staticDownloadUrl(bookPath: string, fileName: string, format: string): string {
  const segments = [...bookPath.split('/'), `${fileName}.${format.toLowerCase()}`];
  return '/files/' + segments.map(encodeURIComponent).join('/');
}
