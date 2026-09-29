import type { RawSearchParams } from '@/lib/library-params';

export const FAULT_COOKIE = 'calibre-e2e-fault';

export type FaultScope = 'list' | 'pane';

export interface TestHooks {
  fault: FaultScope | null;
  delayMs: number;
  pageSize: number | null;
}

export const NO_HOOKS: TestHooks = { fault: null, delayMs: 0, pageSize: null };

const MAX_DELAY_MS = 10_000;
const MAX_PAGE_SIZE = 250;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function boundedInt(raw: string | undefined, max: number): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? Math.min(n, max) : null;
}

function asFault(raw: string | undefined): FaultScope | null {
  return raw === 'list' || raw === 'pane' ? raw : null;
}

export function readTestHooks(
  params: RawSearchParams,
  faultCookie: string | undefined,
  enabled = process.env.CALIBRE_E2E === '1',
): TestHooks {
  if (!enabled) return NO_HOOKS;
  return {
    fault: asFault(first(params['__fault'])) ?? asFault(faultCookie),
    delayMs: boundedInt(first(params['__delay']), MAX_DELAY_MS) ?? 0,
    pageSize: boundedInt(first(params['__pageSize']), MAX_PAGE_SIZE),
  };
}

export async function applyTestHooks(
  hooks: TestHooks,
  scope: FaultScope,
): Promise<void> {
  if (scope === 'list' && hooks.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, hooks.delayMs));
  }
  if (hooks.fault === scope) throw new Error(`Injected ${scope} fault`);
}
