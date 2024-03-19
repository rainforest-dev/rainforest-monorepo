<template>
  <div class="flex items-center justify-center size-full">
    <VueFlow :nodes="nodes" fit-view-on-init>
      <Controls />
    </VueFlow>
  </div>
</template>
<script setup lang="ts">
import type { Elements, Node } from '@vue-flow/core';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Controls } from '@vue-flow/controls';
import { ref } from 'vue';
import { useMouse } from '@vueuse/core';

const { screenToFlowCoordinate, onConnect, addEdges, addNodes, onPaneClick } = useVueFlow();

onConnect(addEdges);
onPaneClick((event) => {
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  const id = String(Date.now());
  addNodes([
    {
      id,
      position,
      label: `Node ${id}`,
    },
  ]);
});

const { x, y } = useMouse();

const nodes = ref<Node[]>([
  {
    id: '1',
    position: { x: 50, y: 50 },
    label: 'Node 1',
  },
]);

</script>
<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
</style>
