<!-- apps/loop-observatory/src/components/SetupPanel.vue -->
<script setup lang="ts">
// Type-only imports: this is a client-hydrated island, so importing runtime
// values from lib/enroll would drag its node:fs deps into the browser bundle.
import { onMounted, ref } from 'vue';

import type { Drift } from '@/lib/enroll/drift';
import type { DerivedFile } from '@/lib/enroll/types';
import type { HostState } from '@/lib/enroll/view';

interface Reading {
  ageMs: number;
  source: string;
}

interface HostView {
  state: HostState;
  detail: string | null;
  drift: Drift[];
  files: DerivedFile[];
  error: string | null;
  readings: {
    enrollment: Reading | null;
    telemetry: Reading | null;
    conflict: string | null;
  };
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

/** Mirrors humanAge in drift.ts. Ages arrive as ms; nobody reads ms. */
function age(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec} sec`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return min % 60 ? `${hr} h ${min % 60} min` : `${hr} h`;
  return `${Math.floor(hr / 24)} days`;
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
        <li>
          Join this machine to the tailnet, then check the app answers — that,
          not membership itself, is what the rest of these steps need:
          <pre
            class="bg-muted mt-1 overflow-x-auto rounded p-2"
          ><code>curl -fsS {{ ENROLL_APP_URL }}/api/enroll/probes >/dev/null &amp;&amp; echo reachable</code></pre>
        </li>
        <li>
          Sign in:
          <pre
            class="bg-muted mt-1 overflow-x-auto rounded p-2"
          ><code>claude auth login   # NOT `claude login` — that has no such subcommand
gh auth login -h github.com</code></pre>
          <p class="text-muted-foreground mt-1">
            <code>-h github.com</code> answers the only question
            <code>gh</code> asks before it needs a person: the rest of the flow
            wants a browser, so this step is not one an agent can finish alone.
            Run <code>gh auth status</code> first — a host that is already
            signed in has nothing to do here, and one carrying an
            <em>expired</em> token looks signed in until you look. The
            <code>accounts</code> probe in step 4 reads <code>gh</code>'s login,
            and reports it as absent rather than guessing, so a machine that
            skips this is flagged <code>account-unverified</code> instead of
            quietly passing.
          </p>
        </li>
        <li>
          Fetch the engine onto the machine being enrolled, and check it before
          extracting it. Work in a scratch directory — the first machine
          enrolled this way was given no location, extracted into the Obsidian
          vault root, and synced nine files to every device before anyone
          noticed:
          <pre
            class="bg-muted mt-1 overflow-x-auto rounded p-2"
          ><code>mkdir -p ~/.local/share/loop-enroll && cd ~/.local/share/loop-enroll
curl -fsSL {{ ENROLL_APP_URL }}/api/enroll/bundle -o loop-engine.tar.gz
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
        <li>
          Install the agent skills. These ship as Claude Code plugins from the
          Obsidian vault, which reaches this machine over iCloud — no clone and
          no credentials:
          <pre
            class="bg-muted mt-1 overflow-x-auto rounded p-2"
          ><code>VAULT=~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/rainforest-obsidian
claude plugin marketplace add "$VAULT"
claude plugin install rainforest-core@rainforest
claude plugin install rainforest-work@rainforest       # company machine
# claude plugin install rainforest-personal@rainforest # personal machine instead
claude plugin list</code></pre>
          <p class="text-muted-foreground mt-1">
            Pick <em>one</em> of <code>work</code> /
            <code>personal</code> beside <code>core</code>. That split is the
            point: the boundary used to be enforced at runtime by a rule telling
            the agent to ignore personal skills inside company repos, which
            meant a company machine still had every one of them installed. Now
            it does not have them at all.
          </p>
          <p class="text-muted-foreground mt-1">
            Plugins rather than copied directories because a copy carries no
            version, so nothing can report that it is stale — on 2026-08-31 one
            machine's copy of the setup skill was a month behind the vault and
            had been for a month with no warning.
            <code>claude plugin list</code> prints a version per plugin, which
            makes that visible without anything having to check.
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

        <!-- Both ages, each named by the file it came from. Never merged into
             one "last seen": they are written by different things at different
             rates, and when they disagree that IS the state worth showing. -->
        <dl
          class="text-muted-foreground mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-xs"
        >
          <dt>enrollment</dt>
          <dd>
            <template v-if="view.readings.enrollment">
              {{ age(view.readings.enrollment.ageMs) }} old ·
              <code>{{ view.readings.enrollment.source }}</code>
            </template>
            <template v-else>never reported</template>
          </dd>
          <dt>telemetry</dt>
          <dd>
            <template v-if="view.readings.telemetry">
              {{ age(view.readings.telemetry.ageMs) }} old ·
              <code>{{ view.readings.telemetry.source }}</code>
            </template>
            <template v-else>no snapshot</template>
          </dd>
        </dl>
        <p
          v-if="view.readings.conflict"
          class="mt-2 rounded-md border border-amber-500/40 p-2 text-xs text-amber-700 dark:text-amber-400"
        >
          {{ view.readings.conflict }}
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
