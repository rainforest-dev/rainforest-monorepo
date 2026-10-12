import type { ParseOutcome } from './query-parse';

export type ParseStatus =
  | { kind: 'off' }
  | { kind: 'unsupported-browser' }
  | { kind: 'unavailable' }
  | { kind: 'unsupported-language'; lang: string }
  | { kind: 'needs-download' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'ai' }
  | { kind: 'ai-timeout' }
  | { kind: 'local' };

export function statusFor({
  supported,
  on,
  progress,
  capability,
  lang,
  parsed,
}: {
  supported: boolean;
  on: boolean;
  progress: number | undefined;
  capability:
    | 'unsupported'
    | 'unavailable'
    | 'downloadable'
    | 'downloading'
    | 'ready'
    | undefined;
  lang: string;
  parsed: ParseOutcome<unknown>['status'] | undefined;
}): ParseStatus {
  if (!supported) return { kind: 'unsupported-browser' };
  if (!on) return { kind: 'off' };
  if (progress !== undefined) return { kind: 'downloading', progress };
  switch (capability) {
    case 'unavailable':
      return lang === 'en'
        ? { kind: 'unavailable' }
        : { kind: 'unsupported-language', lang };
    case 'unsupported':
      return { kind: 'unavailable' };
    case 'downloadable':
      return { kind: 'needs-download' };
    case 'downloading':
      return { kind: 'downloading', progress: 0 };
    default:
      return parsed ? { kind: parsed } : { kind: 'off' };
  }
}
