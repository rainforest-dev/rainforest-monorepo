<script lang="ts" setup>
import '@rainforest-dev/rainforest-ui/lit/design-system/colors';
import '@rainforest-dev/rainforest-ui/lit/design-system/typography';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
</script>

<template>
  <Tabs default-value="colors">
    <TabsList>
      <TabsTrigger value="colors">Colors</TabsTrigger>
      <TabsTrigger value="typography">Typography</TabsTrigger>
    </TabsList>
    <TabsContent value="colors" class="py-10">
      <rf-design-system-colors />
    </TabsContent>
    <TabsContent value="typography" class="py-10">
      <rf-design-system-typography />
    </TabsContent>
  </Tabs>
</template>
