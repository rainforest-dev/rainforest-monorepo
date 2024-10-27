<template>
  <input
    type="color"
    name="source-color"
    id="source-color"
    :value="sourceColor"
    @change="updateSourceColor"
  />
  <label for="source-color">Source Color</label>
</template>
<script lang="ts" setup>
import { computed, effect, ref } from 'vue';
import {
  argbFromHex,
  themeFromSourceColor,
  applyTheme,
} from '@material/material-color-utilities';
import { useStore } from '@nanostores/vue';
import { sourceColor } from '../stores';

const $sourceColor = useStore(sourceColor);
const theme = computed(() =>
  themeFromSourceColor(argbFromHex($sourceColor.value))
);

const updateSourceColor = (event: Event) => {
  sourceColor.set((event.target as HTMLInputElement).value);
  document.documentElement.style.setProperty(
    '--color-source-color',
    $sourceColor.value
  );
};

effect(() => {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  console.log('Applying theme', theme.value);
  applyTheme(theme.value, {
    target: document.body,
    dark: systemDark,
  });
});
</script>
