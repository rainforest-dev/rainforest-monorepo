import { describe, expect, it, vi } from 'vitest';

import { forwardToNotebook } from './notebook-app';

describe('forwardToNotebook', () => {
  const env = { NOTEBOOK_INTERNAL_URL: 'http://notebook.test:8086/notebooks' };

  it('streams the upload on with the inbox secret and returns the answer', async () => {
    const seen: Request[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init) => {
      seen.push(new Request(url, init));
      return Response.json({ notebookId: 4, added: [9] }, { status: 200 });
    }) as unknown as typeof fetch;
    const form = new FormData();
    form.append('notebook', 'Inbox Log');
    form.append('file', new File([new Uint8Array([1, 2])], 'p.jpg'));
    const request = new Request('https://calibre.test/api/inbox/bujo', {
      method: 'POST',
      headers: { 'x-inbox-secret': 's3', cookie: 'session=1' },
      body: form,
    });

    const response = await forwardToNotebook(
      request,
      '/api/inbox/bujo',
      env,
      fetchImpl,
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ notebookId: 4, added: [9] });
    const [sent] = seen;
    expect(sent?.url).toBe(
      'http://notebook.test:8086/notebooks/api/inbox/bujo',
    );
    expect(sent?.headers.get('x-inbox-secret')).toBe('s3');
    expect(sent?.headers.get('cookie')).toBeNull();
    expect(sent?.headers.get('content-type')).toMatch(/^multipart\/form-data/);
    expect((await sent?.formData())?.get('notebook')).toBe('Inbox Log');
  });

  it('passes the notebook app’s refusal through', async () => {
    const fetchImpl = (async () =>
      Response.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )) as typeof fetch;
    const response = await forwardToNotebook(
      new Request('https://calibre.test/api/inbox/bujo', {
        method: 'POST',
        body: 'x',
      }),
      '/api/inbox/bujo',
      env,
      fetchImpl,
    );
    expect(response?.status).toBe(401);
  });

  it('is null while NOTEBOOK_INTERNAL_URL is unset', async () => {
    const request = new Request('https://c.test/api/inbox/bujo', {
      method: 'POST',
      body: 'x',
    });
    expect(await forwardToNotebook(request, '/api/inbox/bujo', {})).toBeNull();
  });
});
