// The answer strip's three states, which until now were only ever verified by driving a real
// browser by hand. Each of them was, at some point, silently wrong: the strip vanished instead of
// answering (no session), vanished instead of reporting a rejected argument (schema near-miss),
// and said "couldn't answer" when it meant "took too long" (the composable converts a throw into
// null, so the timeout never reached the catch that classified it).
//
// The AI composable and the tool catalog are mocked rather than exercised: the point here is the
// component's own branching, and the catalog's real implementation drags in the content library.
// selectTool's behaviour has its own tests in utils/ai/language-model.test.ts.
import type { AiState } from '@utils/ai';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const aiState = ref<AiState>({ kind: 'ready' });
const aiError = ref<Error | null>(null);
const selectToolMock = vi.fn();
const executeMock = vi.fn();

vi.mock('@utils/ai', () => ({
  useLanguageModel: () => ({
    state: aiState,
    error: aiError,
    refresh: vi.fn(),
    enable: vi.fn(),
    selectTool: selectToolMock,
  }),
  registerAgentTools: () => ({ registered: [], dispose: vi.fn() }),
}));

vi.mock('../../mcp/catalog', () => ({
  PROFILE_TOOLS: [
    {
      name: 'get_projects',
      description: 'Portfolio projects',
      params: {},
      run: vi.fn(),
      summarise: () => 'vue appears in 0 projects.',
    },
  ],
  toToolDescriptors: () => [
    {
      name: 'get_projects',
      description: 'Portfolio projects',
      inputSchema: {},
      execute: executeMock,
    },
  ],
}));

const { default: CommandPalette } = await import('./CommandPalette.vue');

const RECORDS = [
  {
    id: 'p1',
    kind: 'project' as const,
    title: 'Hoogii Wallet',
    keywords: ['react'],
    href: '/portfolio/hoogii-wallet',
  },
];

/** Opens the palette, types `query`, and activates the Ask row. */
async function ask(query: string) {
  const wrapper = mount(CommandPalette, {
    props: { records: RECORDS, lang: 'en' as const },
    attachTo: document.body,
  });
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
  );
  await flushPromises();

  const input = wrapper.find('input');
  await input.setValue(query);

  const askRow = wrapper
    .findAll('[role="option"]')
    .find((row) => row.text().includes('Ask:'));
  if (!askRow) throw new Error('no Ask row rendered');
  await askRow.trigger('click');
  await flushPromises();
  return wrapper;
}

describe('CommandPalette answer strip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiState.value = { kind: 'ready' };
    aiError.value = null;
  });

  it('states the answer when the ask succeeds', async () => {
    selectToolMock.mockResolvedValue({ tool: 'get_projects' });
    executeMock.mockResolvedValue([]);

    const wrapper = await ask('what projects use vue?');

    expect(wrapper.text()).toContain('vue appears in 0 projects.');
  });

  // The composable returns null and parks the cause in `error` rather than rethrowing, so this
  // case reaches the `!choice` branch — not the catch. Classifying only in the catch left this
  // message unreachable, which is exactly the bug this pins.
  it('says the model took too long when the run was aborted', async () => {
    selectToolMock.mockResolvedValue(null);
    aiError.value = new DOMException('aborted', 'AbortError');

    const wrapper = await ask('what projects use vue?');

    expect(wrapper.text()).toContain('took too long');
    expect(wrapper.text()).not.toContain("Couldn't answer");
  });

  it('says it could not answer when the failure is not an abort', async () => {
    selectToolMock.mockResolvedValue(null);
    aiError.value = new Error('kErrorUnknown');

    const wrapper = await ask('what projects use vue?');

    expect(wrapper.text()).toContain("Couldn't answer");
    expect(wrapper.text()).not.toContain('took too long');
  });

  // A rejected argument is a distinct path from a failed selection: the model chose a tool, and
  // `execute` refused its arguments. It used to render as the same silent nothing.
  it('reports a rejected argument rather than showing nothing', async () => {
    selectToolMock.mockResolvedValue({ tool: 'get_projects' });
    executeMock.mockRejectedValue(new Error('invalid enum value'));

    const wrapper = await ask('what projects use vue?');

    expect(wrapper.text()).toContain("Couldn't answer");
  });

  it('offers no Ask row when the model is not ready', async () => {
    aiState.value = { kind: 'unsupported' };
    const wrapper = mount(CommandPalette, {
      props: { records: RECORDS, lang: 'en' as const },
      attachTo: document.body,
    });
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
    );
    await flushPromises();
    await wrapper.find('input').setValue('what projects use vue?');

    expect(
      wrapper.findAll('[role="option"]').some((r) => r.text().includes('Ask:')),
    ).toBe(false);
    expect(selectToolMock).not.toHaveBeenCalled();
  });
});
