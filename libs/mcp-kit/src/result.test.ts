import {
  isToolContent,
  toolContent,
  toolError,
  ToolInputError,
  toolResult,
} from './result';

describe('toolResult', () => {
  it('returns JSON text and structuredContent for a plain object', () => {
    const data = { results: [{ date: '2024-01-01' }], semantic: 'off' };
    expect(toolResult(data)).toEqual({
      content: [{ type: 'text', text: JSON.stringify(data) }],
      structuredContent: data,
    });
  });

  it.each([[[1, 2]], ['text'], [3], [null], [undefined]])(
    'returns text only for %j',
    (data) => {
      expect(toolResult(data)).toEqual({
        content: [{ type: 'text', text: JSON.stringify(data ?? null) }],
      });
    },
  );
});

describe('toolContent', () => {
  it('passes image and text blocks through toolResult unchanged', () => {
    const content = [
      { type: 'text' as const, text: 'page 1' },
      { type: 'image' as const, data: 'aGVsbG8=', mimeType: 'image/png' },
    ];
    const value = toolContent(content);
    expect(isToolContent(value)).toBe(true);
    expect(toolResult(value)).toEqual({ content });
  });

  it('does not mistake plain data for content', () => {
    expect(isToolContent({ content: [] })).toBe(false);
    expect(toolResult({ content: [] })).toEqual({
      content: [{ type: 'text', text: '{"content":[]}' }],
      structuredContent: { content: [] },
    });
  });
});

describe('toolError', () => {
  it('keeps the message of a ToolInputError', () => {
    expect(toolError(new ToolInputError('from must be before to'))).toEqual({
      content: [{ type: 'text', text: 'from must be before to' }],
      isError: true,
    });
  });

  it.each([
    new Error('ENOENT: /Users/someone/data/timeline.json'),
    'a string',
    undefined,
  ])('hides anything else behind a generic message', (error) => {
    expect(toolError(error)).toEqual({
      content: [{ type: 'text', text: 'Internal error' }],
      isError: true,
    });
  });
});
