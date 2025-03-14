<template>
  <md-fab
    v-if="!isChatBubbleEnabled"
    class="fixed bottom-10 right-10 z-10"
    variant="tertiary"
    aria-label="back to top"
    @click="handleClick"
  >
    <span class="material-symbols-outlined" slot="icon"> arrow_upward </span>
  </md-fab>
  <div v-else class="fixed bottom-10 right-10 z-10">
    <md-icon-button
      id="social-media-anchor"
      variant="tertiary"
      aria-label="contact me"
      @click="handleClick"
      class="size-14"
    >
      <md-icon> chat_bubble </md-icon>
    </md-icon-button>
    <md-menu
      ref="menu"
      id="menu"
      anchor="social-media-anchor"
      :menuCorner="Corner.END_END"
      :anchorCorner="Corner.START_END"
      class="bg-surface-variant!"
    >
      <md-menu-item
        :href="getLinkedInUrl(info.links.linkedin)"
        target="_blank"
        class="text-surface"
      >
        <iconify-icon :icon="getBrandIconName('linkedin')" slot="start" />
        LinkedIn
      </md-menu-item>
      <md-menu-item :href="getGitHubUrl(info.links.github)" target="_blank">
        <iconify-icon :icon="getBrandIconName('github')" slot="start" />
        GitHub
      </md-menu-item>
      <md-menu-item :href="`mailto:${info.email}`" target="_blank">
        <md-icon slot="start" class="size-4 text-base">email</md-icon>
        Email
      </md-menu-item>
    </md-menu>
  </div>
</template>
<script lang="ts" setup>
import 'iconify-icon';
import '@material/web/fab/fab.js';
import '@material/web/iconbutton/icon-button';
import { Corner, MdMenu } from '@material/web/menu/menu.js';
import '@material/web/menu/menu-item.js';
import { getBrandIconName, isServerSide } from '@utils';
import { useWindowScroll } from '@vueuse/core';
import { computed, useTemplateRef } from 'vue';
import {
  info,
  getGitHubUrl,
  getLinkedInUrl,
} from '@rainforest-dev/personal-data';

const menu = useTemplateRef<MdMenu>('menu');

const { y } = useWindowScroll();
const isAtTop = computed(() => {
  return isServerSide ? true : Math.round(y.value / window.innerHeight);
});
const isChatBubbleEnabled = computed(() => isAtTop.value);

const handleClick = () => {
  if (isChatBubbleEnabled.value) {
    if (menu.value) menu.value.open = !menu.value.open;
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
</script>
