import { z } from 'zod';

import { defineTool, toJsonSchema } from './tool';

describe('defineTool', () => {
  it('ties run to the input and output shapes', () => {
    const tool = defineTool({
      name: 'typed',
      description: 'Typed',
      input: { query: z.string(), limit: z.number().default(10) },
      output: { count: z.number() },
      run: ({ query, limit }) => {
        expectTypeOf(query).toEqualTypeOf<string>();
        expectTypeOf(limit).toEqualTypeOf<number>();
        return { count: limit };
      },
    });
    expect(tool.name).toBe('typed');

    defineTool({
      name: 'wrong_output',
      description: 'Wrong output',
      input: {},
      output: { count: z.number() },
      // @ts-expect-error count must be a number
      run: () => ({ count: 'many' }),
    });

    defineTool({
      name: 'wrong_input',
      description: 'Wrong input',
      input: { query: z.string() },
      // @ts-expect-error renamed key is not in the input shape
      run: ({ q }) => q,
    });
  });
});

describe('toJsonSchema', () => {
  it('matches the website descriptor for the same shape', () => {
    const tool = defineTool({
      name: 'get_projects',
      description: 'Portfolio projects, optionally filtered by technology',
      input: {
        technology: z.enum(['react', 'vue']).optional(),
        lang: z.enum(['en', 'zh']).optional(),
      },
      run: () => [],
    });

    expect(toJsonSchema(tool)).toEqual({
      name: 'get_projects',
      description: 'Portfolio projects, optionally filtered by technology',
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          technology: { type: 'string', enum: ['react', 'vue'] },
          lang: { type: 'string', enum: ['en', 'zh'] },
        },
        additionalProperties: false,
      },
    });
  });

  it('lists defaulted input fields as required and adds output and annotations', () => {
    const tool = defineTool({
      name: 'search',
      description: 'Search',
      input: {
        query: z.string(),
        limit: z.number().int().default(10),
      },
      output: { total: z.number() },
      annotations: { readOnlyHint: true },
      run: () => ({ total: 0 }),
    });

    const descriptor = toJsonSchema(tool);
    expect(descriptor.inputSchema).toMatchObject({
      required: ['query', 'limit'],
    });
    expect(descriptor.outputSchema).toMatchObject({
      type: 'object',
      properties: { total: { type: 'number' } },
      required: ['total'],
    });
    expect(descriptor.annotations).toEqual({ readOnlyHint: true });
  });
});
