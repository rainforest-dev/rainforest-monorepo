import { beforeAll, describe, expect, it, vi } from 'vitest';

import { setUpNotebookShelf } from '@/test';

import { GET, POST } from './route';

// `connection()` needs a request scope that a direct handler call does not have.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => undefined,
}));

beforeAll(() => {
  setUpNotebookShelf('calibre-notebooks-route-');
});

const create = (body: unknown) =>
  POST(
    new Request('https://calibre.example.test/api/notebooks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

describe('POST /api/notebooks', () => {
  it('creates a notebook with a trimmed name and lists it', async () => {
    const response = await create({ name: '  Field Log  ' });
    expect(response.status).toBe(201);
    const { notebook } = await response.json();
    expect(notebook).toMatchObject({
      name: 'Field Log',
      status: 'active',
      endedOn: null,
    });

    const listed = await (await GET()).json();
    expect(listed.notebooks).toEqual([
      expect.objectContaining({ id: notebook.id, pageCount: 0 }),
    ]);
  });

  it('refuses a name already taken with 409', async () => {
    await create({ name: 'Taken' });
    const response = await create({ name: 'Taken' });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/already exists/);
  });

  it.each<[string, unknown]>([
    ['no body', 'not json'],
    ['no name', {}],
    ['a blank name', { name: '   ' }],
    ['a name that is not a string', { name: 42 }],
    ['a name over 120 characters', { name: 'x'.repeat(121) }],
  ])('answers 422 to %s', async (_, body) => {
    const response = await create(body);
    expect(response.status).toBe(422);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});
