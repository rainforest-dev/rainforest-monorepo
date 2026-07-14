<script setup lang="ts">
import { ArrowLeftRight, Ban, CircleDot, History, ListChecks } from '@lucide/vue';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { LoopState } from '@/lib/loop';

defineProps<{ loop: LoopState | null }>();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <CircleDot class="size-4" />
        Loop status
      </CardTitle>
      <CardDescription>
        Autonomous task-loop state from the vault queue, progress log and handoffs.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div
        v-if="!loop"
        class="text-muted-foreground py-8 text-center text-sm"
      >
        No loop state available.
      </div>

      <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Claimed + Blocked -->
        <div class="space-y-5">
          <div>
            <p
              class="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            >
              <ListChecks class="size-3.5" /> Claimed
            </p>
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
              No task currently claimed.
            </p>
          </div>

          <div>
            <p
              class="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            >
              <Ban class="size-3.5" /> Blocked
            </p>
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
            <p v-else class="text-muted-foreground text-sm">Nothing blocked.</p>
          </div>
        </div>

        <!-- Recent activity -->
        <div class="space-y-5">
          <div>
            <p
              class="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            >
              <History class="size-3.5" /> Recent rounds
            </p>
            <ul v-if="loop.recent_rounds.length" class="space-y-1.5">
              <li
                v-for="(r, i) in loop.recent_rounds"
                :key="i"
                class="flex items-baseline gap-2 text-sm"
              >
                <Badge variant="outline" class="shrink-0 tabular-nums text-[10px]">
                  {{ r.date }}
                </Badge>
                <span class="text-muted-foreground">{{ r.note }}</span>
              </li>
            </ul>
            <p v-else class="text-muted-foreground text-sm">No rounds recorded.</p>
          </div>

          <div v-if="loop.recent_progress.length">
            <p
              class="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide"
            >
              Progress log
            </p>
            <ul class="space-y-1.5">
              <li
                v-for="(p, i) in loop.recent_progress"
                :key="i"
                class="flex items-baseline gap-2 text-sm"
              >
                <span class="text-muted-foreground shrink-0 tabular-nums text-xs">
                  {{ p.date }}
                </span>
                <span class="text-foreground">{{ p.title }}</span>
              </li>
            </ul>
          </div>

          <div>
            <p
              class="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            >
              <ArrowLeftRight class="size-3.5" /> Last handoff
            </p>
            <p
              v-if="loop.last_handoff"
              class="text-foreground text-sm"
            >
              {{ loop.last_handoff }}
            </p>
            <p v-else class="text-muted-foreground text-sm">No handoffs recorded.</p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
