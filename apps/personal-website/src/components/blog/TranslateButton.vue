<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

import { Button } from '@/components/ui/button';
import {
  type AiState,
  destroyTranslator,
  detectTranslatorCapability,
  TranslateError,
  type TranslateFailure,
  translateChunks,
} from '@utils/ai';

/**
 * Translates the rendered article in place, on-device.
 *
 * This fills a real gap rather than duplicating i18n: the site's UI is already bilingual through
 * i18next, but every blog post exists only in English. There is nothing to switch to, so the
 * choice is between machine translation in the reader's browser and nothing at all.
 *
 * A separate control from the summarize one, in its own card, because the two capabilities
 * degrade independently — a browser can ship Summarizer and still not have this language pair.
 */
const props = defineProps<{ target?: string }>();

const PAIR = {
  sourceLanguage: 'en',
  targetLanguage: props.target ?? 'zh-Hant',
};

const state = ref<AiState>({ kind: 'unsupported' });
const busy = ref(false);
const translated = ref(false);
const failure = ref<TranslateFailure | null>(null);
const done = ref(0);
const total = ref(0);

/**
 * The nodes whose text gets replaced, paired with their original text so the toggle can restore
 * them without a reload.
 *
 * Deliberately narrow: paragraphs, list items and headings. Code blocks, inline code and KaTeX
 * output are excluded — translating a code sample corrupts it, and the math nodes carry rendered
 * markup whose text content is not prose at all.
 */
let originals: Array<{ node: HTMLElement; text: string }> = [];

function collectProseNodes(): Array<{ node: HTMLElement; text: string }> {
  const article = document.querySelector('article');
  if (!article) return [];
  const candidates = article.querySelectorAll<HTMLElement>('p, li, h2, h3, h4');
  return [...candidates]
    .filter((node) => {
      if (node.closest('pre, code, .katex, .not-prose')) return false;
      // A paragraph that only wraps a KaTeX block has no prose of its own.
      if (node.querySelector('pre, code, .katex')) return false;
      const text = node.textContent?.trim() ?? '';
      return text.length > 0;
    })
    .map((node) => ({ node, text: node.textContent ?? '' }));
}

async function refresh() {
  state.value = await detectTranslatorCapability(PAIR);
}

async function run() {
  if (busy.value) return;

  // Toggling back is local: the originals are held in memory, so restoring costs nothing and
  // never re-runs the model.
  if (translated.value) {
    for (const { node, text } of originals) node.textContent = text;
    translated.value = false;
    return;
  }

  busy.value = true;
  failure.value = null;
  done.value = 0;
  originals = collectProseNodes();
  total.value = originals.length;

  try {
    await translateChunks(
      originals.map((entry) => entry.text),
      PAIR,
      {
        onProgress: (value) => {
          if (value < 1) state.value = { kind: 'downloading', progress: value };
        },
        // Swapped in as each lands rather than all at the end: a page-length article takes long
        // enough that a motionless page reads as a hang.
        onChunk: (index, text) => {
          const entry = originals[index];
          if (entry) entry.node.textContent = text;
          done.value = index + 1;
        },
      },
    );
    translated.value = true;
    state.value = { kind: 'ready' };
  } catch (cause) {
    failure.value = cause instanceof TranslateError ? cause.reason : 'failed';
    // Put back whatever was already swapped, so a partial failure never leaves the article
    // half in one language and half in the other.
    for (const { node, text } of originals) node.textContent = text;
    translated.value = false;
    await refresh();
  } finally {
    busy.value = false;
  }
}

onMounted(refresh);
onUnmounted(destroyTranslator);

const FAILURE_COPY: Record<string, string> = {
  timeout: '翻譯逾時，已還原原文。',
  'too-long': '這篇文章太長，裝置端模型無法翻譯。',
  'needs-gesture': '模型下載需要直接點擊才能開始，請再按一次。',
  failed: '裝置端翻譯失敗，已還原原文。',
};
</script>

<template>
  <div
    v-if="state.kind !== 'unsupported' && state.kind !== 'unavailable'"
    class="not-prose my-6"
  >
    <!-- Its own opaque surface, same reason as the summarize control: on a post with a hero image
         the article is pulled up over the photo, where muted text is unreadable. -->
    <div class="bg-card rounded-lg border p-3">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="outline" :disabled="busy" @click="run">
          <span v-if="busy">翻譯中… {{ done }}/{{ total }}</span>
          <span v-else-if="translated">顯示原文</span>
          <span v-else-if="state.kind === 'downloadable'"
            >翻譯成中文（需下載模型）</span
          >
          <span v-else>翻譯成中文</span>
        </Button>
        <span
          v-if="busy && state.kind === 'downloading'"
          class="text-foreground/80 text-sm"
        >
          正在下載翻譯模型…
        </span>
        <span class="text-muted-foreground text-xs">
          完全在你的瀏覽器內執行，文章不會傳送到任何地方。程式碼與數學式維持原樣。
        </span>
      </div>

      <p
        v-if="failure"
        class="text-muted-foreground mt-3 text-sm"
        role="status"
        aria-live="polite"
      >
        {{ FAILURE_COPY[failure] }}
      </p>
    </div>
  </div>
</template>
