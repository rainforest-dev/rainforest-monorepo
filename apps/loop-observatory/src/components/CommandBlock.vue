<!-- apps/loop-observatory/src/components/CommandBlock.vue -->
<script setup lang="ts">
/**
 * A command block with a copy button that only claims to have copied.
 *
 * The command is passed in as a slotted `<pre>` and copied out of the DOM
 * rather than handed in as a string prop. Vue disables whitespace condensing
 * inside `<pre>` and its descendants, so what a reader sees and what the
 * clipboard receives are the same characters -- where a parallel array of
 * template literals would be two things that merely look alike, and would drift
 * the first time one of these commands was edited in place.
 *
 * The clipboard itself is not assumed; see `lib/clipboard.ts` for why, and for
 * the fallback. When even that fails the label reads `select it`, because a
 * button reporting a success it did not have is the same defect as a page
 * reporting health it never checked.
 */
import { onBeforeUnmount, ref, useTemplateRef } from 'vue';

import { COPY_FEEDBACK_MS, copyText } from '@/lib/clipboard';

const wrapper = useTemplateRef<HTMLElement>('wrapper');
const state = ref<'idle' | 'copied' | 'failed'>('idle');
let timer: ReturnType<typeof setTimeout> | undefined;

const LABEL = { idle: 'copy', copied: 'copied', failed: 'select it' } as const;

async function copy() {
  const text = wrapper.value?.querySelector('pre')?.textContent?.trim() ?? '';
  if (!text) return;
  state.value = (await copyText(text)) ? 'copied' : 'failed';
  clearTimeout(timer);
  timer = setTimeout(() => (state.value = 'idle'), COPY_FEEDBACK_MS);
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div
    ref="wrapper"
    class="bg-muted mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded p-2 [&>pre]:overflow-x-auto"
  >
    <slot />
    <button
      type="button"
      class="border-border bg-card text-muted-foreground hover:text-foreground h-7 shrink-0 rounded-md border px-2.5 font-mono text-[10px] transition-colors"
      :title="
        state === 'failed'
          ? 'This browser refused clipboard access — select the command instead'
          : 'Copy this command'
      "
      @click="copy"
    >
      {{ LABEL[state] }}
    </button>
    <!-- Announced separately: a button whose own label changes is not reliably
         re-read by a screen reader, and the failure case is the one a reader
         most needs told. -->
    <span class="sr-only" role="status" aria-live="polite">
      <template v-if="state === 'copied'">Command copied</template>
      <template v-else-if="state === 'failed'">
        Copy failed — select the command manually
      </template>
    </span>
  </div>
</template>
