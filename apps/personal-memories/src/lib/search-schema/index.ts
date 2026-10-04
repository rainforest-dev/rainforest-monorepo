import { z } from 'astro/zod';

export const searchQuerySchema = z.object({
  text: z.string().max(200),
  range: z.object({ start: z.iso.date(), end: z.iso.date() }).optional(),
  people: z.array(z.string()).optional(),
  sources: z.array(z.enum(['line', 'slack', 'photo'])).optional(),
});

let jsonSchema: Record<string, unknown> | undefined;

export const searchQueryJsonSchema = (): Record<string, unknown> =>
  (jsonSchema ??= z.toJSONSchema(searchQuerySchema));
