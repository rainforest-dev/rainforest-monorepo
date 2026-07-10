<template>
  <Button
    v-if="!isChatBubbleEnabled"
    variant="default"
    size="icon"
    class="fixed bottom-10 right-10 z-10 size-14 rounded-full shadow-lg"
    aria-label="back to top"
    @click="handleClick"
  >
    <ArrowUp />
  </Button>
  <div v-else class="fixed bottom-10 right-10 z-10">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          id="social-media-anchor"
          variant="default"
          size="icon"
          aria-label="contact me"
          class="size-14 rounded-full shadow-lg"
        >
          <MessageCircle />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <DropdownMenuItem as-child>
          <a
            :href="getLinkedInUrl(info.links.linkedin)"
            target="_blank"
            class="flex items-center gap-2"
          >
            <iconify-icon :icon="getBrandIconName('linkedin')" class="size-4" />
            LinkedIn
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <a
            :href="getGitHubUrl(info.links.github)"
            target="_blank"
            class="flex items-center gap-2"
          >
            <iconify-icon :icon="getBrandIconName('github')" class="size-4" />
            GitHub
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <a :href="`mailto:${info.email}`" class="flex items-center gap-2">
            <Mail class="size-4" />
            Email
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
<script lang="ts" setup>
import 'iconify-icon';
import {
  getBrandIconName,
  getGitHubUrl,
  getLinkedInUrl,
  isServerSide,
} from '@utils';
import { useWindowScroll } from '@vueuse/core';
import { ArrowUp, Mail, MessageCircle } from '@lucide/vue';
import { computed } from 'vue';
import { info } from '@utils/constants';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const { y } = useWindowScroll();
const isAtTop = computed(() => {
  return isServerSide ? true : Math.round(y.value / window.innerHeight);
});
const isChatBubbleEnabled = computed(() => isAtTop.value);

const handleClick = () => {
  if (isChatBubbleEnabled.value) return; // DropdownMenuTrigger already handles opening
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
</script>
