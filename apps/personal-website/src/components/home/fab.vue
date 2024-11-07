<template>
  <button
    class="size-12 rounded-full shadow fixed right-10 bottom-10 cursor-pointer"
    @click="handleClick"
  >
    <span class="material-symbols-outlined"> arrow_upward </span>
  </button>
</template>
<script lang="ts" setup>
const handleClick = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
</script>
