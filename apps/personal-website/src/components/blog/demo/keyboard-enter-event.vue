<template>
  <div class="flex flex-col gap-4">
    <input
      placeholder="Press any key to test."
      @keydown="handleKeydown"
      @focusout="handleFocusout"
      :inputmode="inputmode"
      :autocapitalize="autocapitalize"
    />
    Last Pressed: {{ lastPressedKey }}
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';

const autocapitalize = ref<
  'sentences' | 'words' | 'characters' | 'none' | undefined
>(undefined);
const inputmode = ref<'text' | 'numeric' | 'url' | 'email'>('email');
const lastPressedKey = ref('');

const handleKeydown = (e: KeyboardEvent) => {
  lastPressedKey.value = e.key;
  if (e.key === 'Enter') {
    console.log('Enter key pressed', e);
  }
};

const handleFocusout = (e: FocusEvent) => {
  console.log('Input lost focus', e);
  lastPressedKey.value = 'focus out';
};
</script>
