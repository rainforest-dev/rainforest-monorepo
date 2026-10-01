import { z } from 'zod';

import type { RawSearchParams } from './library-params';

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

const positiveIntString = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .refine((n) => n >= 1);

function boundedInt(raw: string | undefined, max: number): number | null {
  const parsed = positiveIntString.safeParse(raw);
  return parsed.success ? Math.min(parsed.data, max) : null;
}

const faultScopeSchema = z.enum(['list', 'pane']);

function asFault(raw: string | undefined): FaultScope | null {
  const parsed = faultScopeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
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
