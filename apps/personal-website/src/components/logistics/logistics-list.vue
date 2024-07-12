<script lang="ts" setup>
import { useStore } from '@nanostores/vue';
import PostItem from './post-item.vue'
import { logistics } from '../../stores';

const $logistics = useStore(logistics);
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li v-for="[trackingNumber, { carrier }] in Object.entries($logistics)" :key="trackingNumber">
      <PostItem v-if="carrier === 'post'" :tracking-number="trackingNumber" />
      <template v-else>
        <span>{{ carrier }}</span>
        <span>{{ trackingNumber }}</span>
      </template>
    </li>
  </ul>
</template>