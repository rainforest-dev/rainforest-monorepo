<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  type AiState,
  detectCapability,
  detectSummarizerCapability,
  detectTranslatorCapability,
} from '@utils/ai';

/**
 * Probes the three built-in AI APIs in the reader's own browser and reports what it found.
 *
 * A live probe rather than a compatibility table copied from a doc, because the interesting fact
 * about this platform right now is how *unevenly* it has landed — and a static table cannot show
 * you your own browser. Measured 2026-07-29, Chrome 150 and Edge 150 are both Chromium 150 and
 * still disagree: Edge ships Summarizer and Translator with no Prompt API at all. Version
 * sniffing would get this wrong; only feature detection gets it right.
 *
 * Every row degrades on its own. A browser with none of them sees an honest "not here yet" rather
 * than an empty table or a thrown error — unlike ../webgpu/check-gpu.vue, which throws outright
 * when WebGPU is absent.
 */

type Row = {
  name: string;
  what: string;
  state: AiState | null;
};

const rows = ref<Row[]>([
  {
    name: 'Prompt API',
    what: 'Free-form generation and tool selection',
    state: null,
  },
  {
    name: 'Summarizer',
    what: 'Condenses a passage into key points',
    state: null,
  },
  {
    name: 'Translator',
    what: 'Translates between a language pair',
    state: null,
  },
]);

const probing = ref(true);

onMounted(async () => {
  // Probed with the exact options each feature would use: availability is answered per
  // configuration and per language pair, so a bare probe can report "ready" about something the
  // caller never asked for.
  const [prompt, summarizer, translator] = await Promise.all([
    detectCapability(),
    detectSummarizerCapability({
      type: 'key-points',
      format: 'markdown',
      length: 'short',
    }),
    detectTranslatorCapability({
      sourceLanguage: 'en',
      targetLanguage: 'zh-Hant',
    }),
  ]);
  rows.value[0]!.state = prompt;
  rows.value[1]!.state = summarizer;
  rows.value[2]!.state = translator;
  probing.value = false;
});

const LABELS: Record<AiState['kind'], string> = {
  unsupported: 'Not in this browser',
  unavailable: 'Present, unavailable here',
  downloadable: 'Available — needs a download',
  downloading: 'Downloading',
  ready: 'Ready now',
};

const supported = (state: AiState | null) =>
  state !== null &&
  state.kind !== 'unsupported' &&
  state.kind !== 'unavailable';

const noneSupported = computed(
  () => !probing.value && rows.value.every((row) => !supported(row.state)),
);
</script>

<template>
  <div class="not-prose my-6 rounded-lg border p-4">
    <p class="text-muted-foreground mb-3 text-xs uppercase">
      Your browser, right now
    </p>

    <p v-if="probing" class="text-muted-foreground text-sm">Checking…</p>

    <table v-else class="w-full text-sm">
      <thead>
        <tr class="text-muted-foreground text-left text-xs uppercase">
          <th class="pb-2 font-normal">API</th>
          <th class="pb-2 font-normal">What it does</th>
          <th class="pb-2 font-normal">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.name" class="border-t">
          <td class="py-2 pr-3 font-medium">{{ row.name }}</td>
          <td class="text-muted-foreground py-2 pr-3">{{ row.what }}</td>
          <td class="py-2">
            <span
              :class="
                supported(row.state) ? 'text-primary' : 'text-muted-foreground'
              "
            >
              {{ row.state ? LABELS[row.state.kind] : '—' }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <!--
      The fallback that matters. A reader on Firefox or Safari today sees all three unsupported,
      and telling them plainly beats an empty table — the point of the post is that this is uneven,
      so "nothing here yet" is itself the result, not a failure.
    -->
    <p v-if="noneSupported" class="text-muted-foreground mt-3 text-sm">
      None of these are in this browser yet. That is the normal case today — the
      recording below shows what the features look like where they do run.
    </p>
  </div>
</template>
