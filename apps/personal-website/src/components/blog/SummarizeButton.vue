<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { Button } from '@/components/ui/button';
import { useSummarizer } from '@utils/ai';
import { isSummarizable, toProse } from '@utils/article-text';

// `text` is the post's MDX body, passed from the layout rather than scraped from the DOM.
// Scraping would pick up the nav, the comment widget and the footer; the collection body is
// exactly the article and nothing else.
const props = defineProps<{ text: string }>();

// key-points over tldr: these are technical posts, and a reader deciding whether to invest ten
// minutes is served better by "what is in here" than by a compressed narrative.
const { state, summary, failure, busy, progress, refresh, run, reset } =
  useSummarizer({ type: 'key-points', format: 'markdown', length: 'short' });

// Probe on mount, not at module load: `Summarizer` is only meaningful in the browser. Re-probing
// per mount also matters under ClientRouter, which remounts on every navigation — a verdict from
// the previous page would otherwise linger.
onMounted(refresh);

const prose = computed(() => toProse(props.text));

/**
 * Posts that are mostly imports, headings and live island tags have nothing to summarize. Asking
 * anyway does not fail — it returns the source echoed back, which reads as a broken feature. Found
 * by running this against web-ai.mdx, whose body is almost entirely demo components.
 */
const worthSummarizing = computed(() => isSummarizable(props.text));

const canRender = computed(
  () =>
    worthSummarizing.value &&
    state.value.kind !== 'unsupported' &&
    state.value.kind !== 'unavailable',
);

const FAILURE_COPY: Record<string, string> = {
  timeout:
    'The on-device model took too long. The article is below, unchanged.',
  'too-long': 'This article is too long for the on-device model to summarize.',
  'needs-gesture':
    'The model download needs a direct click to start. Try the button again.',
  failed: "The on-device model couldn't summarize this one.",
};
</script>

<template>
  <!--
    Renders only when the browser can actually do this AND the post has prose worth reducing.
    `unsupported` (no Summarizer — Firefox/Safari today) and `unavailable` (present, but this
    machine can't serve it) both render nothing rather than a control that would fail on click.
  -->
  <div v-if="canRender" class="not-prose my-6">
    <!--
      Its own opaque surface, not just the article wrapper's. On a post with a hero image the
      article is pulled up over the photo, and `bg-background/25 backdrop-blur-sm` is not enough
      to keep small muted text legible against a photograph — it was measurably unreadable there.
    -->
    <div class="bg-card rounded-lg border p-3">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          variant="outline"
          size="default"
          :disabled="busy"
          @click="summary || failure ? reset() : run(prose)"
        >
          <span v-if="busy">Summarizing…</span>
          <span v-else-if="summary || failure">Hide summary</span>
          <span v-else-if="state.kind === 'downloadable'"
            >Summarize on-device (downloads a model)</span
          >
          <span v-else>Summarize this post</span>
        </Button>
        <!--
          The download is hundreds of megabytes, so a first run would otherwise look like a hang.
          Naming it as a download is the difference between "slow" and "broken".
        -->
        <span
          v-if="busy && state.kind === 'downloading'"
          class="text-foreground/80 text-sm"
        >
          Downloading the model… {{ Math.round(progress * 100) }}%
        </span>
        <span class="text-muted-foreground text-xs">
          Runs entirely in your browser — the article is never sent anywhere.
        </span>
      </div>

      <div
        v-if="summary"
        class="border-border mt-3 border-t pt-3"
        role="region"
        aria-label="On-device summary"
      >
        <p class="text-muted-foreground mb-2 text-xs uppercase">
          On-device summary
        </p>
        <!-- Rendered as text, not markdown: this is model output, and injecting it as HTML would
             hand an unreviewed generator a path into the page. -->
        <p class="whitespace-pre-line text-sm">{{ summary }}</p>
      </div>

      <p
        v-else-if="failure"
        class="text-muted-foreground mt-3 text-sm"
        role="status"
        aria-live="polite"
      >
        {{ FAILURE_COPY[failure] }}
      </p>
    </div>
  </div>
</template>
