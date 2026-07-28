<script setup lang="ts">
import { onMounted } from 'vue';

import { useLanguageModel } from './use-language-model';

// Slot per state. This component supplies no copy and no assets: the blog demos provide the
// recorded fallback, and because ⌘K degrades to deterministic search, the `unsupported` slot's
// default is the plain search UI rather than an apology.
const { state, error, refresh, enable } = useLanguageModel();

onMounted(refresh);
</script>

<template>
  <slot v-if="state.kind === 'ready'" name="ready" />
  <slot
    v-else-if="state.kind === 'downloading'"
    name="downloading"
    :progress="state.progress"
  />
  <slot
    v-else-if="state.kind === 'downloadable'"
    name="downloadable"
    :enable="enable"
  />
  <slot v-else-if="state.kind === 'unavailable'" name="unavailable" />
  <slot v-else name="unsupported" :error="error" />
</template>
