<template>
  <input
    type="color"
    name="source-color"
    id="source-color"
    :value="$sourceColor"
    @change="updateSourceColor"
  />
  <label for="source-color">Source Color</label>
</template>
<script lang="ts" setup>
import { useStore } from '@nanostores/vue';
import { sourceColor, updateSourceColor as _updateSourceColor } from '@stores';

const $sourceColor = useStore(sourceColor);

const updateSourceColor = (event: Event) => {
  const sourceColor = (event.target as HTMLInputElement).value;
  _updateSourceColor(sourceColor);
  location.reload();
};
</script>
