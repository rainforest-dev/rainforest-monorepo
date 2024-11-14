<template>
  <md-fab
    variant="tertiary"
    @click="handleClick"
    class="fixed right-10 bottom-10"
  >
    <span class="material-symbols-outlined" slot="icon"> arrow_upward </span>
  </md-fab>
</template>
<script lang="ts" setup>
import '@material/web/fab/fab.js';

const handleClick = () => {
  console.log('scroll to top');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
</script>
