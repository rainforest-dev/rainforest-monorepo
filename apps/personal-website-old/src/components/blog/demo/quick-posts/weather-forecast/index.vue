<template>
  <table class="w-full font-sans text-base font-semibold">
    <tbody>
      <row
        v-for="row in data"
        v-bind="row"
        :lower-bound="lowerBound"
        :upper-bound="upperBound"
      />
    </tbody>
  </table>
  <md-outlined-button class="px-6" @click="random"> Random </md-outlined-button>
</template>
<script lang="ts" setup>
import '@material/web/button/outlined-button';
import { computed, onMounted, ref } from 'vue';
import { addDays } from 'date-fns';
import Row from './row.vue';

const createRandomData = (lower = 10, upper = 30) => {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(now, i);
    const tempMin = lower + Math.floor(Math.random() * (upper - lower));
    const tempMax =
      tempMin + 1 + Math.floor(Math.random() * (upper - tempMin - 1));
    return {
      date,
      tempMin,
      tempMax,
    };
  });
};
const data = ref<ReturnType<typeof createRandomData>>([]);
const lowerBound = computed(
  () => Math.floor(Math.min(...data.value.map((row) => row.tempMin)) / 10) * 10,
);
const upperBound = computed(
  () => Math.ceil(Math.max(...data.value.map((row) => row.tempMax)) / 10) * 10,
);

const random = () => {
  data.value = createRandomData();
};

onMounted(() => {
  random();
});
</script>
