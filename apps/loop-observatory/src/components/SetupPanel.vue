<!-- apps/loop-observatory/src/components/SetupPanel.vue -->
<script setup lang="ts">
// Type-only imports where the module reaches node: this is a client-hydrated
// island, so a runtime import from lib/enroll or lib/budget would drag their
// node:fs deps into the browser bundle. `machineReadings.ts` is deliberately
// node-free, so the sentences it builds are imported for real and unit-tested
// rather than restated in this template.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import CommandBlock from '@/components/CommandBlock.vue';
import type { MachineBudget, MachineBudgetMap } from '@/lib/budget';
import { COPY_FEEDBACK_MS, copyText } from '@/lib/clipboard';
import type { Drift } from '@/lib/enroll/drift';
import type { DerivedFile, HostFacts } from '@/lib/enroll/types';
import type { HostState } from '@/lib/enroll/view';
import {
  enrollmentDoubt,
  type HostReadings,
  type Reading,
  snapshotFreshness,
  snapshotSays,
} from '@/lib/machineReadings';

interface HostView {
  state: HostState;
  detail: string | null;
  drift: Drift[];
  files: DerivedFile[];
  error: string | null;
  readings: HostReadings;
}

interface HostRecord {
  facts: HostFacts | null;
  reportedAt: number | null;
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

/** Status colours, always paired with a word — never colour on its own. */
const OK_STYLE = { color: 'var(--status-good)' };
const WARN_STYLE = { color: 'var(--status-warning)' };
const BAD_STYLE = { color: 'var(--status-critical)' };

// Hardcoded on purpose, not derived from window.location.origin. This page is
// commonly viewed through a Cloudflare-fronted hostname, which is an address
// for the *viewer's* browser, not for the machine running install.sh. That
// machine needs an address it can reach directly and unattended; going
// through Cloudflare would route it into an interactive login it has no way
// to complete. The tailnet IP is the one address that works from the
// enrolling machine regardless of how the person reading this page got here.
const ENROLL_APP_URL = 'http://100.86.67.66:3099';

/** Mirrors STALE_AFTER_MS in drift.ts: the window the report is valid for. */
const EXPIRES_AFTER_MS = 15 * 60 * 1000;

const views = ref<Record<string, HostView>>({});
const records = ref<Record<string, HostRecord>>({});
const budgets = ref<MachineBudgetMap>({});
const loading = ref(true);
const loadError = ref<string | null>(null);
/**
 * When the ages in `views` were measured. They arrive as durations, so turning
 * one back into a clock time needs the instant it was taken from -- not
 * `Date.now()` at render, which drifts by however long the page has been open.
 */
const loadedAt = ref(Date.now());
/** Hosts whose reported payload is expanded. */
const openPayloads = ref<Set<string>>(new Set());

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    // The budget snapshot is the OTHER reading, and it is optional: if it
    // fails, the right-hand column says it has no snapshot rather than leaving
    // the enrollment report looking like the only source that was ever checked.
    const [hRes, bRes] = await Promise.all([
      fetch('/api/enroll/hosts'),
      fetch('/api/budget').catch(() => null),
    ]);
    if (!hRes.ok) throw new Error(`/api/enroll/hosts HTTP ${hRes.status}`);
    const hData = (await hRes.json()) as {
      views?: Record<string, HostView>;
      records?: Record<string, HostRecord>;
    };
    loadedAt.value = Date.now();
    views.value = hData.views ?? {};
    records.value = hData.records ?? {};

    if (bRes?.ok) {
      const bData = (await bRes.json()) as MachineBudgetMap | { error: string };
      budgets.value = 'error' in bData ? {} : bData;
    } else {
      budgets.value = {};
    }
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

/** The age said again as a clock time, because "21 h 39 min ago" is hard to
 *  line up against a terminal scrollback and "12:19 yesterday" is not. */
function clockTime(ms: number): string {
  const at = new Date(loadedAt.value - ms);
  const time = at.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const days = Math.floor(
    (new Date(loadedAt.value).setHours(0, 0, 0, 0) -
      new Date(at).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (days === 0) return time;
  if (days === 1) return `${time} yesterday`;
  return `${time} on ${at.toLocaleDateString()}`;
}

interface ColumnPair {
  host: string;
  view: HostView;
  /** Enrollment side: the report expires and nothing re-sends it. */
  expiry: { label: string; style: Record<string, string> };
  lastSent: string;
  doubt: string;
  /** Snapshot side: a different file, on a different clock. */
  written: string;
  writtenStyle: Record<string, string>;
  says: string;
  /**
   * The server's sentence when the two contradict each other, and an explicit
   * statement when they do not. Never blank: an empty right-hand column would
   * read as "checked and fine", which is the inference this page exists to
   * refuse.
   */
  conflict: string;
  conflictStyle: Record<string, string>;
  payload: string | null;
}

const pairs = computed<ColumnPair[]>(() =>
  Object.entries(views.value).map(([host, view]) => {
    const enrollment: Reading | null = view.readings.enrollment;
    const telemetry: Reading | null = view.readings.telemetry;
    const fresh = snapshotFreshness(telemetry);
    const budget: MachineBudget | null = budgets.value[host] ?? null;
    const facts = records.value[host]?.facts ?? null;

    return {
      host,
      view,
      expiry: enrollment
        ? enrollment.ageMs > EXPIRES_AFTER_MS
          ? { label: 'expired', style: WARN_STYLE }
          : { label: 'in window', style: OK_STYLE }
        : { label: 'never sent', style: BAD_STYLE },
      lastSent: enrollment
        ? `${age(enrollment.ageMs)} ago (${clockTime(enrollment.ageMs)})`
        : 'never',
      doubt: enrollmentDoubt(enrollment),
      written: telemetry
        ? `${age(telemetry.ageMs)} ago (${clockTime(telemetry.ageMs)})`
        : 'no snapshot on disk',
      writtenStyle: telemetry
        ? fresh.alive
          ? OK_STYLE
          : WARN_STYLE
        : BAD_STYLE,
      says: snapshotSays(budget),
      conflict:
        view.readings.conflict ??
        (telemetry
          ? 'These two do not contradict each other right now. That is agreement between two sources, not confirmation by one — each is still only as good as its own clock.'
          : 'There is no second reading for this machine, so nothing here has been corroborated. One source agreeing with itself is not two sources agreeing.'),
      conflictStyle: view.readings.conflict ? WARN_STYLE : {},
      payload: facts ? JSON.stringify(facts, null, 2) : null,
    };
  }),
);

/**
 * The re-run button copies; it does not run.
 *
 * This app cannot execute anything on the machine the card describes -- that
 * machine is the one that has not reported, and it is reachable only from its
 * own console. A button wired to a local endpoint would enrol THIS host under
 * another host's name, which is precisely the self-promotion `enroll.sh` is
 * built to make impossible.
 */
const ENROLL_COMMAND = './enroll.sh';
const copiedEnroll = ref<string | null>(null);
let enrollTimer: ReturnType<typeof setTimeout> | undefined;

async function copyEnroll(host: string) {
  const ok = await copyText(ENROLL_COMMAND);
  copiedEnroll.value = ok ? host : null;
  clearTimeout(enrollTimer);
  enrollTimer = setTimeout(() => (copiedEnroll.value = null), COPY_FEEDBACK_MS);
}

function togglePayload(host: string) {
  const next = new Set(openPayloads.value);
  if (next.has(host)) next.delete(host);
  else next.add(host);
  openPayloads.value = next;
}

onMounted(() => {
  load();
  window.addEventListener('lo:refresh', load);
});
onBeforeUnmount(() => {
  window.removeEventListener('lo:refresh', load);
  clearTimeout(enrollTimer);
});
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
          <CommandBlock>
            <pre><code>curl -fsS {{ ENROLL_APP_URL }}/api/enroll/probes >/dev/null &amp;&amp; echo reachable</code></pre>
          </CommandBlock>
        </li>
        <li>
          Sign in:
          <CommandBlock>
            <pre><code>claude auth login   # NOT `claude login` — that has no such subcommand
gh auth login -h github.com</code></pre>
          </CommandBlock>
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
          <CommandBlock>
            <pre><code>mkdir -p ~/.local/share/loop-enroll && cd ~/.local/share/loop-enroll
curl -fsSL {{ ENROLL_APP_URL }}/api/enroll/bundle -o loop-engine.tar.gz
curl -fsSL {{ ENROLL_APP_URL }}/api/enroll/bundle.sha256 -o loop-engine.tar.gz.sha256
shasum -a 256 -c loop-engine.tar.gz.sha256 && tar xzf loop-engine.tar.gz</code></pre>
          </CommandBlock>
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
          <CommandBlock>
            <pre><code>./enroll.sh</code></pre>
          </CommandBlock>
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
          <CommandBlock>
            <pre><code>./install.sh</code></pre>
          </CommandBlock>
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
          Install the agent skills. One source in the vault, which reaches this
          machine over iCloud — no clone and no credentials:
          <CommandBlock>
            <pre><code>VAULT=~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/rainforest-obsidian
PLUGINS="$VAULT/ai-resources/plugins"

# Claude Code
claude plugin marketplace add "$VAULT"
claude plugin install rainforest-core@rainforest
claude plugin install rainforest-work@rainforest       # company machine
# claude plugin install rainforest-personal@rainforest # personal machine instead

# agy (Antigravity / Gemini)
agy plugin install "$PLUGINS/rainforest-core"
agy plugin install "$PLUGINS/rainforest-work"          # match the choice above

# Codex has no plugin system — symlink the SAME two plugins, not all three
mkdir -p ~/.agents/skills
for plugin in rainforest-core rainforest-work; do
  for d in "$PLUGINS/$plugin/skills"/*/; do ln -sfn "${d%/}" ~/.agents/skills/"$(basename "${d%/}")"; done
done
# sweep every symlink here that no longer resolves — including ones this machine
# is no longer entitled to. find, not a glob: zsh aborts on an unmatched one.
find ~/.agents/skills -maxdepth 1 -type l -exec sh -c '[ -e "$1" ] || rm "$1"' _ {} \;</code></pre>
          </CommandBlock>
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
            version, so nothing can report it stale — on 2026-08-31 one
            machine's copy of the setup skill was a month behind the vault and
            had been for a month with no warning.
            <code>claude plugin list</code> and
            <code>agy plugin list</code> both print what is installed.
          </p>
          <p class="text-muted-foreground mt-1">
            The Codex loop names the same two plugins rather than globbing all
            of <code>plugins/*/</code>. Globbing hands Codex the plugin this
            machine deliberately did not install — on 2026-08-31 the personal
            machine's Codex carried all five work skills while its Claude and
            agy correctly had none, so the boundary held for two agents out of
            three. It also creates <code>~/.agents/skills</code> first — on a
            machine that has never run Codex it does not exist, and
            <code>ln</code> would fail once per skill while the loop carried on,
            leaving Codex with nothing and saying so only in a wall of errors.
            The sweep afterwards uses <code>find</code> rather than a glob
            because zsh aborts on one that matches nothing, and it removes every
            link that no longer resolves: these skills moved directories once
            already, and a dangling symlink is not an error to Codex — the skill
            is simply invisible, so nothing reports it.
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

    <section v-else class="flex flex-col gap-4">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 class="font-medium">Enrolled hosts</h2>
        <span class="text-muted-foreground font-mono text-xs">
          enrollment report only · expires 15 min after it is sent
        </span>
      </div>

      <!-- Two columns, and the split is the point. The left one is everything
           `enroll.sh` said about this machine; the right one is the same
           machine read from a different file on a different clock. They are
           never merged, and neither is promoted to "the state". -->
      <article
        v-for="pair in pairs"
        :key="pair.host"
        class="grid grid-cols-1 overflow-hidden rounded-lg border md:grid-cols-2"
      >
        <div class="flex flex-col gap-3 p-4">
          <div class="flex items-start justify-between gap-3">
            <h3 class="font-mono text-sm">{{ pair.host }}</h3>
            <span
              class="border-border shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide"
              :style="pair.expiry.style"
            >
              {{ pair.expiry.label }}
            </span>
          </div>

          <p class="text-sm" :class="STATE_CLASS[pair.view.state]">
            {{ STATE_LABEL[pair.view.state] }}
          </p>
          <p v-if="pair.view.detail" class="text-muted-foreground text-sm">
            {{ pair.view.detail }}
          </p>
          <p v-if="pair.view.error" class="text-sm text-amber-600">
            {{ pair.view.error }}
          </p>

          <dl
            class="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs"
          >
            <dt>source</dt>
            <dd class="text-foreground">enrollment report · hosts.json</dd>
            <dt>last sent</dt>
            <dd :style="pair.expiry.style">{{ pair.lastSent }}</dd>
            <dt>expires after</dt>
            <dd class="text-foreground">15 min · nothing re-sends it</dd>
          </dl>

          <p class="text-sm leading-relaxed">{{ pair.doubt }}</p>

          <ul
            v-if="pair.view.drift.length"
            class="space-y-1 text-sm text-amber-600"
          >
            <li v-for="d in pair.view.drift" :key="d.kind + d.detail">
              {{ d.kind }}: {{ d.detail }}
            </li>
          </ul>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="border-border hover:bg-muted h-9 rounded-md border px-3 text-sm transition-colors"
              title="Copies the command — this app cannot run it on that machine"
              @click="copyEnroll(pair.host)"
            >
              {{
                copiedEnroll === pair.host
                  ? 'copied — run it there'
                  : 'Re-run ./enroll.sh'
              }}
            </button>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground h-9 rounded-md px-3 text-sm transition-colors"
              :aria-expanded="openPayloads.has(pair.host)"
              @click="togglePayload(pair.host)"
            >
              {{ openPayloads.has(pair.host) ? 'Hide' : 'View' }} last payload
            </button>
          </div>
          <p class="text-muted-foreground text-xs">
            That button copies the command. It has to be run on
            <code>{{ pair.host }}</code> itself — nothing here can reach a
            machine that has stopped reporting, and a button that enrolled
            <em>this</em> host under that name would be worse than no button.
          </p>

          <div v-if="openPayloads.has(pair.host)">
            <p class="text-muted-foreground mb-1 font-mono text-xs">
              exactly what this host reported, at the time named above
            </p>
            <pre
              v-if="pair.payload"
              class="bg-muted max-h-72 overflow-auto rounded p-2 text-xs"
            ><code>{{ pair.payload }}</code></pre>
            <p v-else class="text-muted-foreground text-xs">
              No payload on record — this host has never posted its facts.
            </p>
          </div>

          <details v-if="pair.view.files.length">
            <summary class="cursor-pointer text-sm">
              {{ pair.view.files.length }} derived files
            </summary>
            <div v-for="f in pair.view.files" :key="f.path" class="mt-2">
              <p class="font-mono text-xs">{{ f.path }}</p>
              <pre
                class="bg-muted overflow-x-auto rounded p-2 text-xs"
              ><code>{{ f.contents }}</code></pre>
            </div>
          </details>
        </div>

        <div
          class="bg-muted/40 flex flex-col gap-3 border-t p-4 md:border-l md:border-t-0"
        >
          <span
            class="text-muted-foreground font-mono text-[10px] uppercase tracking-wide"
          >
            The other reading of this machine
          </span>
          <dl
            class="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs"
          >
            <dt>source</dt>
            <dd class="text-foreground">
              quota snapshot ·
              <template v-if="pair.view.readings.telemetry">
                {{ pair.view.readings.telemetry.source }}
              </template>
              <template v-else>none on disk</template>
            </dd>
            <dt>written</dt>
            <dd :style="pair.writtenStyle">{{ pair.written }}</dd>
            <dt>says</dt>
            <dd class="text-foreground">{{ pair.says }}</dd>
          </dl>

          <p class="text-sm leading-relaxed" :style="pair.conflictStyle">
            {{ pair.conflict }}
          </p>

          <!-- Same machine, same two readings, drawn as bars. The link exists
               because this column is a summary of Overview's card, and a
               summary a reader cannot get back to the source of is just an
               assertion. -->
          <a
            :href="`/#machine-${pair.host}`"
            class="mt-auto font-mono text-xs text-[var(--status-good)] hover:underline"
          >
            see it on Overview →
          </a>
        </div>
      </article>
    </section>
  </section>
</template>
