<template>
  <input placeholder="Search..." @keydown.enter="handleEnter" />
</template>
<script setup lang="ts">
const handleEnter = (e) => {
  console.log('Enter key pressed', e);
};
</script>
