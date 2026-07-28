<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

import { searchRecords, type Searchable } from '@utils/search';

// `lang` is unused by search, but a later task gates the AI path on locale. Accepting it now
// keeps this component's public signature stable when that lands.
const props = defineProps<{ records: Searchable[]; lang: 'en' | 'zh' }>();

const open = ref(false);
const query = ref('');
const selected = ref(0);
const inputEl = ref<HTMLInputElement | null>(null);

const results = computed(() => searchRecords(query.value, props.records));

/**
 * Rows, not modes. A later task prepends an "Ask" row when on-device AI is available; keeping
 * activation as "activate the selected row" means Enter never changes meaning — only the
 * contents of the list do.
 */
const rows = computed(() => results.value);

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
  open.value = true;
  nextTick(() => inputEl.value?.focus());
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
  if (row) window.location.href = row.href;
}

// Removed on unmount because the layout uses Astro's ClientRouter: components remount on every
// navigation, so a listener left behind would accumulate and fire ⌘K more than once.
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
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
        @input="selected = 0"
      />
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
