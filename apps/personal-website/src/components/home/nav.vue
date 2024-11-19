<template>
  <nav
    :class="
      clsx(
        'fixed top-0 inset-x-0 xl:text-on-surface h-16 px-10 flex-row-center justify-between z-20',
        page > 0 ? 'text-on-surface' : 'text-surface'
      )
    "
  >
    <div></div>
    <div class="hidden md:flex-row-center gap-10">
      <ul class="flex-row-center gap-10">
        <li v-for="{ label, href } in anchors">
          <a :href="href" @click="removeUrlHashAfterNavigation">{{ label }}</a>
        </li>
      </ul>
      <LanguagePicker :langs="langs" />
    </div>
    <div class="md:hidden block">
      <aside
        :class="
          clsx(
            'fixed inset-0 bg-surface-variant text-on-surface-variant px-4',
            open ? 'flex-center flex-col gap-10' : 'hidden'
          )
        "
      >
        <LanguagePicker :langs="langs" />
        <template v-for="section in sections">
          <div class="flex-col-center gap-4 capitalize">
            <h2 class="text-xl font-semibold">{{ section.title }}</h2>
            <ul class="space-y-1">
              <li v-for="link in section.links">
                <a :href="link.href">{{ link.label }}</a>
              </li>
            </ul>
          </div>
        </template>
        <slot name="sider"></slot>
      </aside>
      <md-icon-button @click="open = !open" id="menu-trigger">
        <md-icon
          :class="
            clsx(
              open
                ? 'text-on-surface'
                : clsx(
                    'xl:text-on-surface',
                    page > 0 ? 'text-on-surface' : 'text-surface'
                  )
            )
          "
          >{{ open ? 'close' : 'menu' }}</md-icon
        >
      </md-icon-button>
    </div>
  </nav>
</template>
<script lang="ts" setup>
import '@material/web/iconbutton/icon-button';
import '@material/web/icon/icon';
import '@material/web/menu/menu-item';

import { computed, ref } from 'vue';
import clsx from 'clsx';
import { useWindowScroll } from '@vueuse/core';
import { isServerSide, removeUrlHashAfterNavigation } from '@utils';
import LanguagePicker, {
  IProps as ILanguagePickerProps,
} from './language-picker.vue';

interface ILink {
  label: string;
  href: string;
}

type Props = {
  anchors: ILink[];
  sections: {
    title: string;
    links: ILink[];
  }[];
} & ILanguagePickerProps;

const { anchors, langs, sections } = defineProps<Props>();

const open = ref(false);

const { y } = useWindowScroll();
const page = computed(() => {
  return isServerSide ? 0 : y.value / window.innerHeight;
});
</script>
