<template>
  <div>{{ isGPUSupported ? 'GPU on' : 'GPU off' }}</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const isGPUSupported = computed(() => {
  // check navigator is defined and if it has gpu property
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
});
</script>