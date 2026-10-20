import { BASE_PATH } from './base-path';

export function staticDownloadUrl(
  bookPath: string,
  fileName: string,
  format: string,
): string {
  const segments = [
    ...bookPath.split('/'),
    `${fileName}.${format.toLowerCase()}`,
  ];
  return `${BASE_PATH}/files/` + segments.map(encodeURIComponent).join('/');
}
