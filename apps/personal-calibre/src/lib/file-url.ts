export function staticDownloadUrl(
  bookPath: string,
  fileName: string,
  format: string,
): string {
  const segments = [
    ...bookPath.split('/'),
    `${fileName}.${format.toLowerCase()}`,
  ];
  return '/files/' + segments.map(encodeURIComponent).join('/');
}
