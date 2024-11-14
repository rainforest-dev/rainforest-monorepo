<template>
  <nav
    class="fixed top-0 inset-x-0 xl:text-on-surface h-16 px-10 flex-row-center justify-between z-10 text-surface"
  >
    <div></div>
    <div class="flex-row-center gap-10">
      <ul class="flex-row-center gap-10">
        <li v-for="{ label, href } in anchors">
          <a :href="href" @click="handleClick">{{ label }}</a>
        </li>
      </ul>
      <div class="relative">
        <md-icon-button
          id="language-picker-anchor"
          class="!text-surface !fill-surface"
          @click="menu.open = !menu?.open"
        >
          <md-icon>language</md-icon>
        </md-icon-button>
        <md-menu ref="menu" anchor="language-picker-anchor">
          <md-menu-item v-for="{ label, href } in langs">
            <a slot="headline" :href="href">{{ label }}</a>
          </md-menu-item>
        </md-menu>
      </div>
    </div>
  </nav>
</template>
<script lang="ts" setup>
import '@material/web/iconbutton/icon-button';
import '@material/web/icon/icon';
import { MdMenu } from '@material/web/menu/menu';
import '@material/web/menu/menu-item';

import { useTemplateRef } from 'vue';

interface ILink {
  label: string;
  href: string;
}

interface IProps {
  anchors: ILink[];
  langs: ILink[];
}

const { anchors, langs } = defineProps<IProps>();

const menu = useTemplateRef<MdMenu>('menu');

const handleClick = () => {
  // remove the anchor part of the URL after clicking on a link after 300ms
  requestAnimationFrame(() => {
    window.history.replaceState(
      null,
      '',
      window.location.href.replace(window.location.hash, '')
    );
  });
};
</script>
