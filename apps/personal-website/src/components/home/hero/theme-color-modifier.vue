<template>
  <div class="hidden"></div>
</template>
<script lang="ts" setup>
import useThemeColorMeta from '@/hooks/use-theme-color-meta';
import { isServerSide } from '@/utils';
import { useWindowScroll } from '@vueuse/core';
import { computed, onMounted, onUnmounted, watchEffect } from 'vue';

const { y } = useWindowScroll();
const isAtTop = computed(() => {
  return isServerSide ? true : Math.round(y.value / window.innerHeight) === 0;
});

const mediaQueryList = computed(() => {
  const breakpointXl = getComputedStyle(
    document.documentElement,
  ).getPropertyValue('--breakpoint-xl');
  return window.matchMedia(`(min-width: ${breakpointXl})`);
});
const { updateThemeColor, reset } = useThemeColorMeta();
const handleThemeColor = () => {
  if (isServerSide) return;
  if (mediaQueryList.value.matches) return;
  if (isAtTop.value) {
    updateThemeColor(
      window
        .getComputedStyle(document.body)
        .getPropertyValue('--md-sys-color-inverse-surface'),
    );
  } else {
    reset();
  }
};
watchEffect(handleThemeColor);

const handleResize = (e: MediaQueryListEvent) => {
  if (e.matches) {
    reset();
  } else {
    handleThemeColor();
  }
};

onMounted(() => {
  mediaQueryList.value.addEventListener('change', handleResize);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', handleThemeColor);
});
onUnmounted(() => {
  mediaQueryList.value.removeEventListener('change', handleResize);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .removeEventListener('change', handleThemeColor);
});
</script>
<style>
@reference 'tailwindcss';
</style>
