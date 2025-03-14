<template>
  <div class="relative">
    <md-icon-button ref="anchor" aria-label="language-picker" @click="toggle">
      <md-icon
        :class="
          clsx(
            'text-on-surface-variant xl:text-on-surface',
            !isAtTop ? 'md:text-on-surface' : 'md:text-surface',
          )
        "
        >language</md-icon
      >
    </md-icon-button>
    <md-menu ref="menu" :anchorElement="anchor">
      <md-menu-item v-for="{ label, href, key } in langs">
        <a slot="headline" :href="href" @click="cacheLocale(key)">{{
          label
        }}</a>
      </md-menu-item>
    </md-menu>
  </div>
</template>
<script lang="ts" setup>
import { MdMenu } from '@material/web/menu/menu';
import { computed, useTemplateRef } from 'vue';
import Cookies from 'js-cookie';
import { isServerSide, persistentLocaleKey } from '@utils';
import { useWindowScroll } from '@vueuse/core';
import clsx from 'clsx';
import { MdIconButton } from '@material/web/iconbutton/icon-button';

interface ILink {
  key: string;
  label: string;
  href: string;
}
export interface IProps {
  langs: ILink[];
}

const { langs } = defineProps<IProps>();

const anchor = useTemplateRef<MdIconButton>('anchor');
const menu = useTemplateRef<MdMenu>('menu');

const toggle = () => {
  if (menu.value) {
    menu.value.open = !menu.value.open;
  }
};

const cacheLocale = (locale: string) => {
  Cookies.set(persistentLocaleKey, locale, {
    path: '/',
  });
};

const { y } = useWindowScroll();
const isAtTop = computed(() => {
  return isServerSide ? true : Math.round(y.value / window.innerHeight) === 0;
});
</script>
