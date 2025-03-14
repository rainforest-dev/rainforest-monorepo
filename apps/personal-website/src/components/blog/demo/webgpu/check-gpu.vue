<template>
  <table>
    <thead>
      <tr>
        <th>Architecture</th>
        <th>Description</th>
        <th>Device</th>
        <th>Vendor</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{{ adapter?.info.architecture }}</td>
        <td>{{ adapter?.info.description }}</td>
        <td>{{ adapter?.info.device }}</td>
        <td>{{ adapter?.info.vendor }}</td>
      </tr>
    </tbody>
  </table>
</template>
<script lang="ts" setup>
import { onMounted, ref } from 'vue';

const adapter = ref<GPUAdapter | null>(null);
onMounted(() => {
  init();
});
async function init() {
  if (!navigator.gpu) {
    throw Error('WebGPU not supported.');
  }

  adapter.value = await navigator.gpu.requestAdapter();
  if (!adapter.value) {
    throw Error("Couldn't request WebGPU adapter.");
  }

  const device = await adapter.value.requestDevice();
  //...
}
</script>
