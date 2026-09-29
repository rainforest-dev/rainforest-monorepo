const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

export function isHttpUrl(value: string): boolean {
  try {
    return SAFE_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function safeExternalHref(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed && isHttpUrl(trimmed) ? trimmed : undefined;
}
