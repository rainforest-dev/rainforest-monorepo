<template>
  <p v-if="unsupported" class="not-prose text-muted-foreground text-sm">
    {{ unsupported }}
  </p>
  <table v-else>
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
const unsupported = ref<string | null>(null);
onMounted(() => {
  init();
});
async function init() {
  // Reported, not thrown. A reader whose browser lacks WebGPU is the ordinary case for this post,
  // and an uncaught error left the table rendered but permanently blank with the reason only in
  // the console.
  if (!navigator.gpu) {
    unsupported.value = 'This browser has no WebGPU.';
    return;
  }

  adapter.value = await navigator.gpu.requestAdapter();
  if (!adapter.value) {
    unsupported.value = 'WebGPU is present, but no adapter was available.';
    return;
  }

  const device = await adapter.value.requestDevice();
  //...
}
</script>
