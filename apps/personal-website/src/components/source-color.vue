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
import {
  sourceColor,
  updateSourceColor as _updateSourceColor,
} from '../stores';
import { applyTheme } from '../utils/md3-utilities';

const $sourceColor = useStore(sourceColor);

const updateSourceColor = (event: Event) => {
  const sourceColor = (event.target as HTMLInputElement).value;
  _updateSourceColor(sourceColor);
  applyTheme(
    sourceColor,
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
};
</script>
