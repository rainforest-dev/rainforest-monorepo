<script setup lang="ts">
import { RefreshCw } from '@lucide/vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';

import BreakdownBars from '@/components/BreakdownBars.vue';
import CollapsibleSection from '@/components/CollapsibleSection.vue';
import LoopPanel from '@/components/LoopPanel.vue';
import MachinesPanel from '@/components/MachinesPanel.vue';
import StatTiles from '@/components/StatTiles.vue';
import TaskTable from '@/components/TaskTable.vue';
import UsageTimeChart from '@/components/UsageTimeChart.vue';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MachineBudgetMap } from '@/lib/budget';
import type { UsageAggregates } from '@/lib/ledger';
import type { LoopState } from '@/lib/loop';
import type { HostReadings } from '@/lib/machineReadings';

const usage = ref<UsageAggregates | null>(null);
const budgets = ref<MachineBudgetMap>({});
const loop = ref<LoopState | null>(null);
/**
 * The second reading for every machine, from the enrollment API.
 *
 * A page whose thesis is that one source is not enough cannot afford to fail
 * closed here: if this fetch dies, the cards fall back to a single labelled
 * reading rather than presenting the quota snapshot as if it had been
 * corroborated by anything.
 */
const readings = ref<Record<string, HostReadings>>({});
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [uRes, bRes, lRes, hRes] = await Promise.all([
      fetch('/api/usage'),
      fetch('/api/budget'),
      fetch('/api/loop'),
      fetch('/api/enroll/hosts').catch(() => null),
    ]);
    if (!uRes.ok) throw new Error(`/api/usage HTTP ${uRes.status}`);
    const uData = (await uRes.json()) as UsageAggregates | { error: string };
    if ('error' in uData) throw new Error(uData.error);
    usage.value = uData;

    if (bRes.ok) {
      const bData = (await bRes.json()) as MachineBudgetMap | { error: string };
      budgets.value = 'error' in bData ? {} : bData;
    } else {
      budgets.value = {};
    }

    if (lRes.ok) {
      const lData = (await lRes.json()) as LoopState | { error: string };
      loop.value = 'error' in lData ? null : lData;
    } else {
      loop.value = null;
    }

    if (hRes?.ok) {
      const hData = (await hRes.json()) as {
        views?: Record<string, { readings: HostReadings }>;
      };
      readings.value = Object.fromEntries(
        Object.entries(hData.views ?? {}).map(([host, v]) => [
          host,
          v.readings,
        ]),
      );
    } else {
      readings.value = {};
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

// The header Refresh button re-runs the vault scripts, then broadcasts this
// event so the dashboard re-fetches the freshly written data.
onMounted(() => {
  load();
  window.addEventListener('lo:refresh', load);
});
onBeforeUnmount(() => window.removeEventListener('lo:refresh', load));
</script>

<template>
  <div v-if="loading" class="text-muted-foreground py-24 text-center">
    Loading usage ledger…
  </div>

  <div v-else-if="error" class="py-16 text-center">
    <p class="text-destructive font-medium">Failed to load usage data.</p>
    <p class="text-muted-foreground mt-1 text-sm">{{ error }}</p>
    <Button class="mt-4" variant="outline" @click="load">
      <RefreshCw class="size-4" /> Retry
    </Button>
  </div>

  <div v-else-if="usage" class="space-y-6">
    <StatTiles :totals="usage.totals" />

    <MachinesPanel
      :budgets="budgets"
      :by-machine="usage.byMachine"
      :modes="loop?.budget_mode_by_machine ?? {}"
      :readings="readings"
    />

    <LoopPanel :loop="loop" />

    <Card>
      <CardHeader>
        <CardTitle>Cost &amp; tokens over time</CardTitle>
        <CardDescription>
          Estimated daily spend and token volume across all sessions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UsageTimeChart :series="usage.dailySeries" />
      </CardContent>
    </Card>

    <!-- Heavy sections: collapsible with an internal scroll so they don't
         dominate the page. Top tasks starts collapsed. -->
    <CollapsibleSection
      title="Breakdown"
      description="Cost by dimension."
      :count="`${usage.byTool.length + usage.byModel.length + usage.byMachine.length} rows`"
    >
      <Tabs default-value="tool">
        <TabsList class="w-full">
          <TabsTrigger value="tool" class="flex-1">Tool</TabsTrigger>
          <TabsTrigger value="model" class="flex-1">Model</TabsTrigger>
          <TabsTrigger value="machine" class="flex-1">Machine</TabsTrigger>
        </TabsList>
        <TabsContent value="tool">
          <BreakdownBars :items="usage.byTool" />
        </TabsContent>
        <TabsContent value="model">
          <BreakdownBars :items="usage.byModel" />
        </TabsContent>
        <TabsContent value="machine">
          <BreakdownBars :items="usage.byMachine" />
        </TabsContent>
      </Tabs>
    </CollapsibleSection>

    <CollapsibleSection
      title="Top tasks by cost"
      description="Grouped by Notion task or provisional key."
      :count="`${usage.byTask.length} tasks`"
      :default-open="false"
    >
      <TaskTable :rows="usage.byTask" />
    </CollapsibleSection>
  </div>
</template>
