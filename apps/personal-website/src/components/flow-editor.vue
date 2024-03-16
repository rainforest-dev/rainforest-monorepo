<template>
  <div class="flex items-center justify-center size-full">
    <VueFlow :nodes="nodes" :edges="edges">
    </VueFlow>
  </div>
</template>
<script setup lang="ts">
import type { Elements } from '@vue-flow/core'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { ref } from 'vue';

const nodes = ref<Elements>([
  {
    id: '1',
    label: 'node 1',
    position: { x: 100, y: 100 },
  },
  {
    id: '2',
    label: 'node 2',
    position: { x: 100, y: 200 },
  },
])

const edges = ref<Elements>([
  {
    id: 'e1-2',
    target: '2',
    source: '1',
  },
])

</script>
<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
</style>