<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

// No `@mcp` path alias is configured for this app (checked tsconfig.json/tsconfig.base.json and
// astro.config.mjs — Astro reads aliases from tsconfig `paths`, and none exists), so this is a
// relative import rather than the `@mcp/catalog` shown in the plan.
import { PROFILE_TOOLS, toToolDescriptors } from '../../mcp/catalog';
import {
  type AgentToolRegistration,
  registerAgentTools,
  useLanguageModel,
} from '@utils/ai';
import { tags } from '@utils/constants';
import { searchRecords, type Searchable } from '@utils/search';

// `lang` is unused by search, but a later task gates the AI path on locale. Accepting it now
// keeps this component's public signature stable when that lands.
const props = defineProps<{ records: Searchable[]; lang: 'en' | 'zh' }>();

const open = ref(false);
const query = ref('');
const selected = ref(0);
const inputEl = ref<HTMLInputElement | null>(null);

const results = computed(() => searchRecords(query.value, props.records));

const {
  state,
  // The composable turns a failed run into `null` + this ref rather than rethrowing, so a
  // timeout never reaches the catch below — reading it here is the only way to tell "took too
  // long" apart from "could not answer".
  error: aiError,
  refresh,
  enable,
  selectTool,
} = useLanguageModel();
const answer = ref<string | null>(null);
const asking = ref(false);
/**
 * Why a failed ask is shown rather than swallowed.
 *
 * This started as a bare `catch` that set `answer` to null, on the reasoning that a failed ask
 * must not break search. It doesn't — but it also made three separate defects indistinguishable
 * from "the model had nothing to say": a missing session, a schema near-miss, and a timeout all
 * rendered as the same silent nothing, with no error in the console either. Two of them survived
 * a full review and only surfaced when the feature was driven by hand in a real browser.
 *
 * 'timeout' is kept distinct from 'failed' because the two ask different things of the reader:
 * one is worth retrying, the other isn't.
 */
const askError = ref<'timeout' | 'failed' | null>(null);

/** Both the run timeout and a caller abort surface as an AbortError; nothing else does. */
const isAbort = (cause: unknown): boolean =>
  cause instanceof DOMException && cause.name === 'AbortError';

/** Both halves of the answer strip, cleared together — three call sites reset this, and a
 *  stale error under a fresh answer is exactly the drift separate assignments invite. */
function resetAnswer() {
  answer.value = null;
  askError.value = null;
}

// No answer strip in zh: E0 pins model output to English because non-English replies are
// unreliable, and English prose above Chinese records reads as a bug rather than a decision.
const canAsk = computed(
  () => props.lang === 'en' && state.value.kind === 'ready',
);

// Gates the enable/downloading chrome the same way canAsk gates the answer strip — the whole AI
// surface stays invisible in zh, not just the sentence, so a reopened zh palette is
// pixel-identical to before this task.
const showAiChrome = computed(() => props.lang === 'en');

const downloadProgress = computed(() =>
  state.value.kind === 'downloading'
    ? Math.round(state.value.progress * 100)
    : 0,
);

type Row = Omit<Searchable, 'kind'> & { kind: Searchable['kind'] | 'ask' };

/**
 * Rows, not modes. Row 0 becomes an "Ask" row when on-device AI can answer and there is
 * something to ask about; keeping activation as "activate the selected row" means Enter never
 * changes meaning — only the contents of the list do.
 */
const rows = computed<Row[]>(() =>
  canAsk.value && query.value.trim()
    ? [
        {
          id: '__ask__',
          kind: 'ask',
          title: `Ask: "${query.value}"`,
          keywords: [],
          href: '',
        },
        ...results.value,
      ]
    : results.value,
);

const SELECTION_SCHEMA = {
  type: 'object',
  required: ['tool'],
  additionalProperties: false,
  properties: {
    tool: { type: 'string', enum: PROFILE_TOOLS.map((tool) => tool.name) },
    // The same enum the tools' own params use, not a free string. Constrained decoding can only
    // emit a member, so the model cannot answer "Vue" where the data says "vue" — it did exactly
    // that when this was `{ type: 'string' }`, and `execute` then (correctly) rejected the near
    // miss, leaving the strip blank. Making the wrong value unrepresentable beats validating it
    // after the fact.
    technology: { type: 'string', enum: tags.skills },
    // A single token, not free text — `search_by_technology` substring-matches technology names
    // ('tailwindcss', 'github-actions'), so a phrase could never match one anyway.
    //
    // This is also, unexpectedly, the entire latency story. Left as `{ type: 'string' }` the model
    // treats the field as room to answer the question itself: measured against Chrome 150 it wrote
    // 2,805 characters of prose — a hallucinated list naming Shopify, Discord and Grafana as Vue
    // projects — and took 39s to do it. That is what the run timeout kept cutting off, and what
    // made latency look bimodal. Denying it spaces collapses the same call to ~1s and yields an
    // actual search term ("script", "Vue.js"). Constraining the output shape turned out to be
    // worth more than any timeout tuning.
    query: { type: 'string', pattern: '^[A-Za-z0-9.#+-]{1,24}$' },
  },
};

// Built once and shared by the ask flow above and the WebMCP registration at the bottom of this
// file — one array of descriptors, not two independently-constructed schema trees.
const toolDescriptors = toToolDescriptors();

async function ask() {
  if (asking.value) return;
  asking.value = true;
  resetAnswer();
  try {
    const choice = await selectTool<{
      tool: string;
      technology?: string;
      query?: string;
    }>(query.value, SELECTION_SCHEMA);
    // null means the call failed; selectTool has already re-read capability state, and the
    // search results below are unaffected. This — not the catch — is the path a timeout takes,
    // because the composable converts a throw into null.
    if (!choice) {
      askError.value = isAbort(aiError.value) ? 'timeout' : 'failed';
      return;
    }
    const tool = PROFILE_TOOLS.find((entry) => entry.name === choice.tool);
    const descriptor = toolDescriptors.find(
      (entry) => entry.name === choice.tool,
    );
    // The model named a tool that isn't in the catalog. `tool` is enum-constrained, so this
    // should be unreachable — but it is a silent dead end if it ever is reached, which is the
    // failure mode this whole strip exists to eliminate.
    if (!tool || !descriptor) {
      askError.value = 'failed';
      return;
    }
    const args = {
      technology: choice.technology,
      query: choice.query,
      lang: props.lang,
    };
    // Go through the validated `execute`, not `tool.run` directly. `technology` is now
    // enum-constrained above, but `query` is still a free string and `responseConstraint` is a
    // request to the platform, not a guarantee we control — a model that ignores the schema is
    // the exact failure E0 exists to catch. Calling `run` on a near-miss value would return a
    // *real* but wrong result ("typescript" vs "TypeScript" silently yields 0 roles) and the
    // strip would state it confidently. `execute` rejects it instead.
    const result = await descriptor.execute(args);
    // The sentence comes from the real result, never from the model.
    answer.value = tool.summarise(result as never, args as never);
  } catch (error) {
    // A failed ask still must not break search — the list below stands untouched. What changed is
    // that the reader is told, instead of being shown a strip that silently disappears.
    answer.value = null;
    askError.value = isAbort(error) ? 'timeout' : 'failed';
  } finally {
    asking.value = false;
  }
}

/**
 * Opens with a clean slate — otherwise a second ⌘K reopens with the previous search still in
 * the box — and focuses the input explicitly. The `autofocus` attribute doesn't fire here: this
 * element is never present at initial page parse (it's inserted by `v-if`), which is exactly
 * the case the HTML attribute doesn't cover. Without this, ⌘K immediately followed by typing —
 * precisely the reflex the shortcut exists to serve — drops the first keystrokes.
 */
function togglePalette() {
  if (open.value) {
    open.value = false;
    return;
  }
  query.value = '';
  selected.value = 0;
  resetAnswer();
  open.value = true;
  nextTick(() => inputEl.value?.focus());
}

function onQueryInput() {
  selected.value = 0;
  resetAnswer();
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    togglePalette();
    return;
  }
  if (!open.value) return;

  if (event.key === 'Escape') {
    open.value = false;
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    selected.value = Math.min(selected.value + 1, rows.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    selected.value = Math.max(selected.value - 1, 0);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    activate(selected.value);
  }
}

function activate(index: number) {
  const row = rows.value[index];
  if (!row) return;
  if (row.id === '__ask__') void ask();
  else window.location.href = row.href;
}

// Removed on unmount because the layout uses Astro's ClientRouter: components remount on every
// navigation, so a listener left behind would accumulate and fire ⌘K more than once.
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

// Re-probes on every mount rather than once globally: state can go ready -> unsupported
// mid-flight (E0 confirms responseConstraint actually works on first real use), and ClientRouter
// remounts this component on every navigation, so a stale verdict from a previous page never
// lingers into the next one.
onMounted(refresh);

// No-ops in every shipping browser today — document.modelContext exists in none of them
// (verified 2026-07-28: Chrome 150, Edge 150, Chromium 148). Wired now because the descriptors
// already exist and the dispose handle makes it leak-free.
//
// Registered inside onMounted, not at setup() top level: setup() also runs during Astro's SSR
// prerender, where there is no `document` at all, and registerAgentTools() dereferences it
// unconditionally. onMounted is the standard Vue SSR-safe boundary — it never runs on the
// server — which is why the ⌘K keydown listener above is wired the same way.
let registration: AgentToolRegistration | undefined;
onMounted(() => {
  registration = registerAgentTools(toolDescriptors);
});
onUnmounted(() => registration?.dispose());
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
  >
    <div
      class="bg-card w-full max-w-xl rounded-lg border shadow-lg"
      role="dialog"
      aria-modal="true"
    >
      <input
        ref="inputEl"
        v-model="query"
        class="w-full border-b bg-transparent px-4 py-3 outline-none"
        placeholder="Search experience, projects, skills…"
        aria-label="Search"
        @input="onQueryInput"
      />
      <div
        v-if="showAiChrome && state.kind === 'downloadable'"
        class="border-b px-4 py-2 text-sm"
      >
        <button
          type="button"
          class="text-primary hover:underline"
          @click="enable"
        >
          Enable on-device AI
        </button>
      </div>
      <div
        v-else-if="showAiChrome && state.kind === 'downloading'"
        class="text-muted-foreground border-b px-4 py-2 text-sm"
      >
        Downloading on-device model… {{ downloadProgress }}%
      </div>
      <div v-if="asking" class="border-b px-4 py-2 text-sm">
        <span class="text-muted-foreground mr-2 text-xs uppercase"
          >On-device answer</span
        >
        <p class="text-muted-foreground">Thinking…</p>
      </div>
      <div v-else-if="answer" class="border-b px-4 py-2 text-sm">
        <span class="text-muted-foreground mr-2 text-xs uppercase"
          >On-device answer</span
        >
        <p>{{ answer }}</p>
      </div>
      <div
        v-else-if="askError"
        class="border-b px-4 py-2 text-sm"
        role="status"
        aria-live="polite"
      >
        <span class="text-muted-foreground mr-2 text-xs uppercase"
          >On-device answer</span
        >
        <p class="text-muted-foreground">
          {{
            askError === 'timeout'
              ? 'The on-device model took too long. Your search results are below.'
              : "Couldn't answer that one. Your search results are below."
          }}
        </p>
      </div>
      <ul class="max-h-80 overflow-y-auto py-1" role="listbox">
        <li
          v-for="(row, index) in rows"
          :key="row.id"
          :aria-selected="index === selected"
          role="option"
          class="cursor-pointer px-4 py-2"
          :class="index === selected ? 'bg-muted' : ''"
          @click="activate(index)"
          @mouseenter="selected = index"
        >
          <span class="text-muted-foreground mr-2 text-xs uppercase">{{
            row.kind
          }}</span>
          {{ row.title }}
        </li>
        <li v-if="rows.length === 0" class="text-muted-foreground px-4 py-2">
          No matches
        </li>
      </ul>
    </div>
  </div>
</template>
