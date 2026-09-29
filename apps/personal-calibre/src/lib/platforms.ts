import type { DeliveryPlatform } from '@/types/delivery';

const ABBREVIATIONS: Record<string, string> = {
  kobo: 'KB',
  notebooklm: 'NLM',
  'readwise-reader': 'RW',
};

export function platformAbbr(key: string): string {
  return ABBREVIATIONS[key] ?? key.slice(0, 3).toUpperCase();
}

export function platformName(
  platforms: readonly DeliveryPlatform[],
  key: string,
): string {
  return platforms.find((p) => p.key === key)?.name ?? key;
}
