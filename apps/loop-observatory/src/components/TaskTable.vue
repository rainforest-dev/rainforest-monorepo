<script setup lang="ts">
import { ExternalLink } from '@lucide/vue';
import { computed } from 'vue';

import { Badge } from '@/components/ui/badge';
import type { TaskRow } from '@/lib/ledger';
import { formatInt, formatTokens, formatUsd } from '@/utils/format';

const props = defineProps<{ rows: TaskRow[] }>();

const maxCost = computed(() =>
  Math.max(1e-9, ...props.rows.map((r) => r.cost)),
);

function notionHref(ref: string): string {
  if (/^https?:\/\//.test(ref)) return ref;
  return `https://www.notion.so/${ref.replace(/-/g, '')}`;
}

const barPct = (cost: number) =>
  `${Math.max(2, (cost / maxCost.value) * 100)}%`;
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[640px] text-sm">
      <thead>
        <tr class="text-muted-foreground border-border border-b text-left">
          <th class="py-2 pr-4 font-medium">Task</th>
          <th class="py-2 pr-4 font-medium">Tools</th>
          <th class="py-2 pr-4 text-right font-medium">Records</th>
          <th class="py-2 pr-4 text-right font-medium">Tokens (in / out)</th>
          <th class="py-2 text-right font-medium">Cost</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.task"
          class="border-border hover:bg-muted/50 border-b transition-colors"
        >
          <td class="max-w-[280px] py-2.5 pr-4">
            <a
              v-if="row.notion_ref"
              :href="notionHref(row.notion_ref)"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary inline-flex items-center gap-1 font-medium hover:underline"
            >
              <span class="truncate">{{ row.task }}</span>
              <ExternalLink class="size-3 shrink-0" />
            </a>
            <span v-else class="flex items-center gap-2">
              <span class="text-foreground truncate font-mono text-xs" :title="row.task">
                {{ row.task }}
              </span>
              <Badge variant="outline" class="shrink-0 text-[10px]">provisional</Badge>
            </span>
          </td>
          <td class="py-2.5 pr-4">
            <div class="flex flex-wrap gap-1">
              <Badge
                v-for="tool in row.tools"
                :key="tool"
                variant="secondary"
                class="text-[10px]"
              >
                {{ tool }}
              </Badge>
              <span v-if="row.tools.length === 0" class="text-muted-foreground">—</span>
            </div>
          </td>
          <td class="text-foreground py-2.5 pr-4 text-right tabular-nums">
            {{ formatInt(row.count) }}
          </td>
          <td class="text-muted-foreground py-2.5 pr-4 text-right tabular-nums">
            {{ formatTokens(row.tokens_in) }} / {{ formatTokens(row.tokens_out) }}
          </td>
          <td class="py-2.5 text-right">
            <div class="flex items-center justify-end gap-2">
              <div class="bg-muted hidden h-1.5 w-16 overflow-hidden rounded-full sm:block">
                <div
                  class="bg-primary h-full rounded-full"
                  :style="{ width: barPct(row.cost) }"
                />
              </div>
              <span class="text-foreground tabular-nums font-medium">
                {{ formatUsd(row.cost) }}
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="rows.length === 0" class="text-muted-foreground py-8 text-center">
      No tasks recorded yet.
    </p>
  </div>
</template>
