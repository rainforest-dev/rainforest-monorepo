type Validated<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly issues: readonly unknown[] };

export type ParserSchema<T> = {
  readonly '~standard': {
    readonly validate: (value: unknown) => Validated<T> | Promise<Validated<T>>;
    readonly jsonSchema: {
      readonly input: (options: {
        readonly target: string;
      }) => Record<string, unknown>;
    };
  };
};

export type ParseOutcome<T> = {
  value: T;
  status: 'ai' | 'ai-timeout' | 'local';
};

export type AiCall = (
  jsonSchema: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<unknown>;

export const PROMPT_TIMEOUT_MS = 1500;

export function jsonSchemaOf(
  schema: ParserSchema<unknown>,
): Record<string, unknown> {
  const { $schema: _, ...rest } = schema['~standard'].jsonSchema.input({
    target: 'draft-2020-12',
  });
  return rest;
}

const TIMEOUT = Symbol('timeout');

export type QueryParser<T, Ctx> = {
  jsonSchema(ctx: Ctx): Record<string, unknown>;
  parse(
    raw: string,
    ctx: Ctx,
    ai: AiCall | undefined,
    signal?: AbortSignal,
  ): Promise<ParseOutcome<T>>;
};

export function createQueryParser<T, Ctx>(config: {
  schema(ctx: Ctx): ParserSchema<T>;
  sanitize?(output: unknown, ctx: Ctx): unknown;
  local(raw: string, ctx: Ctx): T;
  timeoutMs?: number;
}): QueryParser<T, Ctx> {
  const timeoutMs = config.timeoutMs ?? PROMPT_TIMEOUT_MS;
  const jsonSchema = (ctx: Ctx) =>
    jsonSchemaOf(config.schema(ctx) as ParserSchema<unknown>);
  return {
    jsonSchema,
    async parse(raw, ctx, ai, signal) {
      const local = () => config.local(raw, ctx);
      if (!ai) return { value: local(), status: 'local' };
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(TIMEOUT);
        }, timeoutMs);
      });
      try {
        const answer = await Promise.race([
          ai(jsonSchema(ctx), controller.signal),
          timeout,
        ]);
        if (answer === TIMEOUT) return { value: local(), status: 'ai-timeout' };
        const cleaned = config.sanitize ? config.sanitize(answer, ctx) : answer;
        const result = await config.schema(ctx)['~standard'].validate(cleaned);
        return result.issues
          ? { value: local(), status: 'local' }
          : { value: result.value, status: 'ai' };
      } catch {
        return { value: local(), status: 'local' };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    },
  };
}
