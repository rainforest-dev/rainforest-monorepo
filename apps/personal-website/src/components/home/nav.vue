<template>
  <nav
    class="fixed top-0 inset-x-0 text-on-surface h-16 px-10 flex-row-center justify-between"
  >
    <div></div>
    <div class="flex-row-center gap-10">
      <ul class="flex-row-center gap-10">
        <li>
          <a href="#experience" @click="handleClick">{{ t('experience') }}</a>
        </li>
        <li>
          <a href="#skills" @click="handleClick">{{ t('skills') }}</a>
        </li>
      </ul>
      <div class="relative">
        <md-icon-button
          id="language-picker-anchor"
          @click="menu.open = !menu?.open"
        >
          <md-icon>language</md-icon>
        </md-icon-button>
        <md-menu ref="menu" anchor="language-picker-anchor">
          <md-menu-item v-for="lang in supportedLngs">
            <a slot="headline" :href="`/${lang}`">{{ t(lang) }}</a>
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

import { supportedLngs } from '@utils';
import { useTemplateRef } from 'vue';
import { useTranslation } from 'i18next-vue';

const { t } = useTranslation();

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
