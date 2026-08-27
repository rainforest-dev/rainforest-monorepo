<!-- apps/loop-observatory/src/components/SetupPanel.vue -->
<script setup lang="ts">
// Type-only imports: this is a client-hydrated island, so importing runtime
// values from lib/enroll would drag its node:fs deps into the browser bundle.
import { onMounted, ref } from 'vue';

import type { Drift } from '../lib/enroll/drift';
import type { DerivedFile } from '../lib/enroll/types';

interface HostView {
  drift: Drift[];
  files: DerivedFile[];
  error: string | null;
}

const views = ref<Record<string, HostView>>({});
const loading = ref(true);

onMounted(async () => {
  const res = await fetch('/api/enroll/hosts');
  views.value = (await res.json()).views ?? {};
  loading.value = false;
});
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="rounded-lg border p-4">
      <h2 class="font-medium">Before you start</h2>
      <ol class="mt-2 list-decimal space-y-1 pl-5 text-sm">
        <li>Join this machine to the tailnet.</li>
        <li>
          Sign in: <code>claude login</code> and <code>gh auth login</code>.
        </li>
        <li>
          Then run, on the machine being enrolled:
          <pre
            class="bg-muted mt-1 overflow-x-auto rounded p-2"
          ><code>curl -fsSL http://100.86.67.66:3099/api/enroll/bundle | tar xz
./install.sh --enroll --app http://100.86.67.66:3099</code></pre>
        </li>
      </ol>
      <p class="text-muted-foreground mt-2 text-sm">
        Nothing is enabled by enrolling. Every LaunchAgent is written disabled;
        starting an unsupervised executor stays a separate, explicit act.
      </p>
    </div>

    <p v-if="loading" class="text-muted-foreground text-sm">Loading…</p>
    <div
      v-for="(view, host) in views"
      :key="host"
      class="rounded-lg border p-4"
    >
      <h3 class="font-medium">{{ host }}</h3>
      <p v-if="view.error" class="text-sm text-amber-600">{{ view.error }}</p>
      <ul
        v-if="view.drift.length"
        class="mt-2 space-y-1 text-sm text-amber-600"
      >
        <li v-for="d in view.drift" :key="d.kind + d.detail">
          {{ d.kind }}: {{ d.detail }}
        </li>
      </ul>
      <p v-else-if="!view.error" class="mt-2 text-sm text-emerald-600">
        matches its declaration
      </p>
      <details v-if="view.files.length" class="mt-2">
        <summary class="cursor-pointer text-sm">
          {{ view.files.length }} derived files
        </summary>
        <div v-for="f in view.files" :key="f.path" class="mt-2">
          <p class="font-mono text-xs">{{ f.path }}</p>
          <pre
            class="bg-muted overflow-x-auto rounded p-2 text-xs"
          ><code>{{ f.contents }}</code></pre>
        </div>
      </details>
    </div>
  </section>
</template>
