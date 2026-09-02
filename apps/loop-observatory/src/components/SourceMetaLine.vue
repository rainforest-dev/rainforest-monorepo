<script setup lang="ts">
import type { SourceMeta } from '@/lib/loopFreshness';

/**
 * The one line under a section heading that says where the answer came from
 * and how old it is.
 *
 * Every section above it can be empty for two unrelated reasons -- nothing
 * happened, or nothing is writing the file any more -- and for most of this
 * panel's life the two rendered identically. Naming the file and ageing it is
 * what separates them, so it is shown whether the section has data or not: a
 * populated section can be just as stale as an empty one.
 */
defineProps<{ meta: SourceMeta }>();
</script>

<template>
  <p class="text-muted-foreground mb-2 text-xs" :title="meta.path">
    <code class="font-mono">{{ meta.label }}</code>
    <span aria-hidden="true"> · </span>{{ meta.read
    }}<span aria-hidden="true"> · </span>{{ meta.age }}
  </p>
</template>
