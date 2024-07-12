<template>
  <div class="flex items-center gap-2">
    <select v-model="carrier">
      <option value="" selected hidden>請選擇物流</option>
      <option value="post">中華郵政</option>
      <option value="t-cat">黑貓</option>
    </select>
    <input type="text" v-model="input" autocomplete="on">
    <button @click="handleClick" :disabled="disabled" class="cursor-pointer">
      <span class="material-symbols-outlined">add</span>
    </button>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref } from 'vue';
import { addLogistic, type ILogistic } from "../../stores";

const carrier = ref<ILogistic['carrier'] | ''>('');
const input = ref<string>('');
const disabled = computed(() => !input.value || !carrier.value);

const handleClick = () => {
  if (input.value && carrier.value) {
    addLogistic(input.value, carrier.value);
    carrier.value = '';
    input.value = '';
  }
}
</script>