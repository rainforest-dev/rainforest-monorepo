<script setup lang="ts">
import {
  ArrowLeftRight,
  Ban,
  CircleDot,
  History,
  ListChecks,
} from '@lucide/vue';
import { useNow } from '@vueuse/core';
import { computed } from 'vue';

import SourceMetaLine from '@/components/SourceMetaLine.vue';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { LoopState } from '@/lib/loop';
import { emptyReason, sourceMeta } from '@/lib/loopFreshness';

const props = defineProps<{ loop: LoopState | null }>();

/**
 * Ages are rendered against a ticking clock, not frozen at the fetch.
 *
 * The alternative turns this panel's own claim into the thing it was written to
 * stop: a dashboard left open on a second monitor would go on insisting the
 * data was "read 1 min ago" for the rest of the afternoon.
 */
const now = useNow({ interval: 30_000 });
const nowMs = computed(() => now.value.getTime());

const runs = computed(() =>
  props.loop ? sourceMeta(props.loop.sources.runs, nowMs.value) : null,
);
const progress = computed(() =>
  props.loop ? sourceMeta(props.loop.sources.progress, nowMs.value) : null,
);
const handoffs = computed(() =>
  props.loop ? sourceMeta(props.loop.sources.handoffs, nowMs.value) : null,
);

function empty(src: 'runs' | 'progress', nothing: string): string {
  if (!props.loop) return nothing;
  return emptyReason(props.loop.sources[src], nothing, nowMs.value);
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <CircleDot class="size-4" />
        Loop status
      </CardTitle>
      <CardDescription>
        Derived from what the machines write: every
        <code>loop-runs.&lt;machine&gt;.jsonl</code> and the
        <code>loopctl set</code> mirror. Handoffs are this host's only. Each
        section names its file and how old that file's newest entry is.
      </CardDescription>
      <!--
        Which engine each machine runs. Here rather than on a machine card
        because it is a fact about this panel's own trustworthiness: two hosts on
        different releases can enforce different rules, and on 2026-09-02 one was
        three releases behind with every panel still green.
      -->
      <CardDescription v-if="loop?.engines" class="mt-1 font-mono text-xs">
        {{ loop.engines }}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="!loop" class="text-muted-foreground py-8 text-center text-sm">
        No loop state available.
      </div>

      <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Claimed + Blocked -->
        <div class="space-y-5">
          <div>
            <p
              class="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            >
              <ListChecks class="size-3.5" /> Claimed
            </p>
            <SourceMetaLine v-if="runs" :meta="runs" />
            <ul v-if="loop.claimed.length" class="space-y-2">
              <li
                v-for="(c, i) in loop.claimed"
                :key="i"
                class="flex items-start gap-2 text-sm"
              >
                <span
                  class="mt-1.5 inline-block size-2 shrink-0 rounded-full"
                  :style="{ backgroundColor: 'var(--status-good)' }"
                  aria-hidden="true"
                />
                <span class="text-foreground">{{ c.task }}</span>
              </li>
            </ul>
            <p v-else class="text-muted-foreground text-sm">
              {{ empty('runs', 'Nothing running') }}
            </p>
          </div>

          <div>
            <p
              class="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            >
              <Ban class="size-3.5" /> Blocked
            </p>
            <SourceMetaLine v-if="runs" :meta="runs" />
            <ul v-if="loop.blocked.length" class="space-y-2">
              <li v-for="(b, i) in loop.blocked" :key="i" class="text-sm">
                <div class="flex items-start gap-2">
                  <span
                    class="mt-1.5 inline-block size-2 shrink-0 rounded-full"
                    :style="{ backgroundColor: 'var(--status-critical)' }"
                    aria-hidden="true"
                  />
                  <div>
                    <span class="text-foreground">{{ b.task }}</span>
                    <span
                      v-if="b.reason"
                      class="text-muted-foreground block text-xs"
                    >
                      {{ b.reason }}
                    </span>
                  </div>
                </div>
              </li>
            </ul>
            <p v-else class="text-muted-foreground text-sm">
              {{ empty('runs', 'Nothing blocked') }}
            </p>
          </div>
        </div>

        <!-- Recent activity -->
        <div class="space-y-5">
          <div>
            <p
              class="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            >
              <History class="size-3.5" /> Recent rounds
            </p>
            <SourceMetaLine v-if="runs" :meta="runs" />
            <ul v-if="loop.recent_rounds.length" class="space-y-1.5">
              <!-- Inline flow, not a flex row.
                   As a flex row the badge held ~130px and the note wrapped
                   inside the ~230px left over, which at 390px made every entry
                   three lines: `rainforest-air`, then the project, then the
                   outcome. In flow the badge is just the first thing on line
                   one and every line after it spans the full column, so the
                   same text takes two. Identical on a wide screen, where it was
                   one line either way. -->
              <li
                v-for="(r, i) in loop.recent_rounds"
                :key="i"
                class="text-muted-foreground text-sm"
              >
                <Badge
                  variant="outline"
                  class="mr-1.5 align-[0.05em] text-[10px] tabular-nums"
                >
                  {{ r.date }} </Badge
                >{{ r.note }}
              </li>
            </ul>
            <p v-else class="text-muted-foreground text-sm">
              {{ empty('runs', 'No runs recorded') }}
            </p>
          </div>

          <!--
            Rendered even when empty. It used to disappear entirely, which is
            this panel's recurring failure in another shape: a section that
            vanishes cannot say whether nothing happened or nothing is writing
            the file any more.
          -->
          <div>
            <p
              class="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide"
            >
              Progress log
            </p>
            <SourceMetaLine v-if="progress" :meta="progress" />
            <ul v-if="loop.recent_progress.length" class="space-y-1.5">
              <li
                v-for="(p, i) in loop.recent_progress"
                :key="i"
                class="flex items-baseline gap-2 text-sm"
              >
                <span
                  class="text-muted-foreground shrink-0 text-xs tabular-nums"
                >
                  {{ p.date }}
                </span>
                <span class="text-foreground">{{ p.title }}</span>
              </li>
            </ul>
            <p v-else class="text-muted-foreground text-sm">
              {{ empty('progress', 'No progress recorded') }}
            </p>
          </div>

          <div>
            <p
              class="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            >
              <ArrowLeftRight class="size-3.5" /> Last handoff
            </p>
            <SourceMetaLine v-if="handoffs" :meta="handoffs" />
            <p v-if="loop.last_handoff" class="text-foreground text-sm">
              {{ loop.last_handoff }}
            </p>
            <p v-else class="text-muted-foreground text-sm">
              {{
                loop.sources.handoffs.present
                  ? 'No handoff has ever been written here — not “none today”.'
                  : `source not present — ${loop.sources.handoffs.path}`
              }}
            </p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
