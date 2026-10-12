export type OllamaSetupFailure = 'unreachable' | 'no-model' | 'missing-model';

export class OllamaSetupError extends Error {
  readonly reason: OllamaSetupFailure;
  readonly models: readonly string[];

  constructor(
    reason: OllamaSetupFailure,
    models: readonly string[],
    message: string,
  ) {
    super(message);
    this.reason = reason;
    this.models = models;
  }
}

export class OllamaHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Ollama returned HTTP ${status}`);
    this.status = status;
  }
}

export async function assertModel(
  url: string,
  model: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let models: string[];
  try {
    const res = await fetchImpl(`${url}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    models = ((await res.json()) as { models: { name: string }[] }).models.map(
      (m) => m.name,
    );
  } catch (error) {
    throw new OllamaSetupError(
      'unreachable',
      [],
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!model) throw new OllamaSetupError('no-model', models, 'no model given');
  if (!models.includes(model))
    throw new OllamaSetupError(
      'missing-model',
      models,
      `${model} is not available`,
    );
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export async function ollamaChat({
  url,
  model,
  messages,
  format,
  think = false,
  temperature = 0,
  fetch: fetchImpl = fetch,
}: {
  url: string;
  model: string;
  messages: readonly ChatMessage[];
  format?: Record<string, unknown>;
  think?: boolean;
  temperature?: number;
  fetch?: typeof fetch;
}): Promise<string> {
  const res = await fetchImpl(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think,
      options: { temperature },
      ...(format ? { format } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new OllamaHttpError(res.status);
  const { message } = (await res.json()) as { message: { content: string } };
  return message.content;
}
