<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
</script>

<template>
  <Select name="country" autocomplete="shipping country" required>
    <SelectTrigger class="w-full">
      <SelectValue placeholder="Country" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="TW">Taiwan</SelectItem>
    </SelectContent>
  </Select>
</template>
