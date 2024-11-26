<template>
  <div>
    <input
      type="color"
      name="source-color"
      id="source-color"
      v-model="sourceColor"
      @change="reload"
      class="sr-only"
    />
    <label
      for="source-color"
      :style="{ backgroundColor: $sourceColor.value }"
      class="size-8 block rounded-full ring-1 ring-offset-2"
    ></label>
  </div>
</template>
<script lang="ts" setup>
import { useVModel } from '@nanostores/vue';
import { $sourceColor } from '@stores';

const sourceColor = useVModel($sourceColor);

const reload = () => location.reload();
</script>
