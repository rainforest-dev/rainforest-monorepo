<!-- apps/loop-observatory/src/components/SetupPanel.vue -->
<script setup lang="ts">
// Type-only imports: this is a client-hydrated island, so importing runtime
// values from lib/enroll would drag its node:fs deps into the browser bundle.
import { onMounted, ref } from 'vue';

import type { Drift } from '@/lib/enroll/drift';
import type { DerivedFile } from '@/lib/enroll/types';
import type { HostState } from '@/lib/enroll/view';

interface HostView {
  state: HostState;
  detail: string | null;
  drift: Drift[];
  files: DerivedFile[];
  error: string | null;
}

/**
 * One headline per state, and only ONE of them is green.
 *
 * The page used to decide health itself, as "no drift and no error" -- which
 * printed "matches its declaration" in emerald for a host that had no
 * declaration to match and for which zero files had been derived. Nothing here
 * infers anything now: the server names the state and this maps it to words.
 */
const STATE_LABEL: Record<HostState, string> = {
  ok: 'matches its declaration',
  'not-declared':
    'reported facts, but is not declared — nothing can be derived for it',
  stale: 'has not reported recently enough to be trusted',
  drift: 'declared and actual disagree',
  refused: 'derivation refused rather than guess',
};

const STATE_CLASS: Record<HostState, string> = {
  ok: 'text-emerald-600',
  'not-declared': 'text-red-600',
  stale: 'text-amber-600',
  drift: 'text-amber-600',
  refused: 'text-amber-600',
};

// Hardcoded on purpose, not derived from window.location.origin. This page is
// commonly viewed through a Cloudflare-fronted hostname, which is an address
// for the *viewer's* browser, not for the machine running install.sh. That
// machine needs an address it can reach directly and unattended; going
// through Cloudflare would route it into an interactive login it has no way
// to complete. The tailnet IP is the one address that works from the
// enrolling machine regardless of how the person reading this page got here.
const ENROLL_APP_URL = 'http://100.86.67.66:3099';

const views = ref<Record<string, HostView>>({});
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const res = await fetch('/api/enroll/hosts');
    if (!res.ok) throw new Error(`/api/enroll/hosts HTTP ${res.status}`);
    views.value = (await res.json()).views ?? {};
  } catch (e) {
    // readHosts() throws rather than reporting {} on a permissions/IO error,
    // specifically so this failure stays visible instead of reading as "no
    // machines enrolled" -- a spinner that never stops would defeat that at
    // the last step, so it must resolve to a stated error instead.
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="rounded-lg border p-4">
      <h2 class="font-medium">Before you start</h2>
      <p class="text-muted-foreground mt-1 text-sm">
        These steps are server-rendered, so an agent on the machine being
        enrolled can read them with
        <code>curl -fsSL {{ ENROLL_APP_URL }}/setup</code> rather than opening a
        browser. Only the host cards below need JavaScript.
      </p>
      <ol class="mt-2 list-decimal space-y-1 pl-5 text-sm">
        <li>Join this machine to the tailnet.</li>
        <li>
          Sign in: <code>claude login</code> and <code>gh auth login</code>.
        </li>
        <li>
          Fetch the engine onto the machine being enrolled, and check it before
          extracting it:
          <pre
            class="bg-muted mt-1 overflow-x-auto rounded p-2"
          ><code>curl -fsSL {{ ENROLL_APP_URL }}/api/enroll/bundle -o loop-engine.tar.gz
curl -fsSL {{ ENROLL_APP_URL }}/api/enroll/bundle.sha256 -o loop-engine.tar.gz.sha256
shasum -a 256 -c loop-engine.tar.gz.sha256 && tar xzf loop-engine.tar.gz</code></pre>
          <p class="text-muted-foreground mt-1">
            The digest is the one CI published beside the release asset. Served
            from this host over plain <code>http</code>, so it catches a
            truncated or corrupted download — piping straight into
            <code>tar</code> would have extracted a partial engine silently. It
            does not prove provenance: for that, compare against the
            <code>.sha256</code> on the GitHub Release, which is HTTPS from a
            different origin.
          </p>
        </li>
        <li>
          Report what this machine actually is. From the directory
          <code>tar</code> just extracted:
          <pre
            class="bg-muted mt-1 overflow-x-auto rounded p-2"
          ><code>./enroll.sh</code></pre>
          <p class="text-muted-foreground mt-1">
            It fetches the probe list from this app, runs each probe here, and
            posts the answers back. It reports; it does not decide — what a
            machine <em>should</em> be lives in <code>hosts.yaml</code>, so a
            host cannot promote itself by talking to the endpoint. Until a
            machine has done this, the app has no facts to derive from and the
            card below reads <em>stale</em> forever.
          </p>
        </li>
        <li>
          Install the roles this machine is declared to have:
          <pre
            class="bg-muted mt-1 overflow-x-auto rounded p-2"
          ><code>./install.sh</code></pre>
          <p class="text-muted-foreground mt-1">
            Add <code>--host=&lt;name&gt;</code> if this machine's
            <code>scutil --get LocalHostName</code> doesn't match its entry. The
            extracted <code>hosts.yaml</code> beside <code>install.sh</code>
            already carries every declared host, so if this machine is one of
            them there is nothing to edit. If it isn't, add it there to get
            through this step — but that edit lives only in this extracted copy;
            declaring a host for good is a commit to the repo, which is what
            keeps a machine from declaring itself.
          </p>
        </li>
      </ol>
      <p class="text-muted-foreground mt-2 text-sm">
        The executor is disabled: install.sh runs
        <code>launchctl disable</code> on <code>loop-ralph</code>, so starting
        it stays a separate, explicit act. The supporting agents — quota
        refresh, the telemetry sink, the relay and the publisher — are installed
        enabled and load at your next login, because they are the services this
        machine was declared to run.
      </p>
    </div>

    <p v-if="loading" class="text-muted-foreground text-sm">Loading…</p>

    <div v-else-if="loadError" class="rounded-lg border p-4">
      <p class="text-sm font-medium text-red-600">Failed to load hosts.</p>
      <p class="text-muted-foreground mt-1 text-sm">{{ loadError }}</p>
      <button
        type="button"
        class="mt-3 rounded-md border px-3 py-1.5 text-sm"
        @click="load"
      >
        Retry
      </button>
    </div>

    <template v-else>
      <div
        v-for="(view, host) in views"
        :key="host"
        class="rounded-lg border p-4"
      >
        <h3 class="font-medium">{{ host }}</h3>
        <p class="mt-1 text-sm" :class="STATE_CLASS[view.state]">
          {{ STATE_LABEL[view.state] }}
        </p>
        <p v-if="view.detail" class="text-muted-foreground mt-1 text-sm">
          {{ view.detail }}
        </p>
        <p v-if="view.error" class="mt-1 text-sm text-amber-600">
          {{ view.error }}
        </p>
        <ul
          v-if="view.drift.length"
          class="mt-2 space-y-1 text-sm text-amber-600"
        >
          <li v-for="d in view.drift" :key="d.kind + d.detail">
            {{ d.kind }}: {{ d.detail }}
          </li>
        </ul>
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
    </template>
  </section>
</template>
