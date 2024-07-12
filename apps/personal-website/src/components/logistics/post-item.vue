<script lang="ts" setup>
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query'
import { format } from 'date-fns'
import { fetchLogisticFromPost } from '../../services'
const { trackingNumber } = defineProps(['trackingNumber'])

const { data: logistic } = useQuery<Awaited<ReturnType<typeof fetchLogisticFromPost>>>({
  queryKey: ['trackingNumber', trackingNumber],
  queryFn: () => fetchLogisticFromPost(trackingNumber)
})
const latestEvent = computed(() => logistic.value?.events[0])
</script>

<template>
  <div class="flex items-center gap-2 px-4 py-3 border rounded">
    <div class="flex flex-col gap-0.5">
      <h1>{{ latestEvent?.name }}</h1>
      <span>{{ latestEvent?.timestamp ? format(latestEvent.timestamp, 'yyyy-MM-dd HH:mm a') : '' }}</span>
    </div>
    <span>{{ trackingNumber }}</span>
  </div>
</template>