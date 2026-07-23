<template>
  <nav
    :class="
      clsx(
        'xl:text-foreground flex-row-center fixed inset-x-0 top-0 z-20 h-16 justify-between px-10',
        !isAtTop ? 'text-foreground' : 'text-background',
      )
    "
  >
    <div></div>
    <div class="md:flex-row-center hidden gap-10">
      <ul class="flex-row-center gap-10">
        <li v-for="{ label, href } in anchors" :key="href">
          <a :href="href" @click="removeUrlHashAfterNavigation">{{ label }}</a>
        </li>
      </ul>
      <LanguagePicker :langs="langs" />
    </div>
    <div class="block md:hidden">
      <aside
        :class="
          clsx(
            'bg-background text-foreground fixed inset-0 overflow-auto px-4 py-6 text-center',
            open ? 'flex-center flex-col gap-10' : 'hidden',
          )
        "
      >
        <LanguagePicker :langs="langs" />
        <slot name="sider"></slot>
      </aside>
      <Button
        variant="ghost"
        size="icon"
        class="relative z-30"
        @click="open = !open"
        id="menu-trigger"
        aria-label="menu-and-close"
      >
        <X v-if="open" class="text-foreground" />
        <Menu
          v-else
          :class="
            clsx(
              'xl:text-foreground',
              !isAtTop ? 'text-foreground' : 'text-background',
            )
          "
        />
      </Button>
    </div>
  </nav>
</template>
<script lang="ts" setup>
import { computed, ref, watchEffect } from 'vue';
import clsx from 'clsx';
import { Menu, X } from '@lucide/vue';
import { useWindowScroll } from '@vueuse/core';
import { isServerSide, removeUrlHashAfterNavigation } from '@utils';
import { Button } from '@/components/ui/button';
import LanguagePicker from './language-picker.vue';
import type { IProps as ILanguagePickerProps } from './language-picker.vue';
import useThemeColorMeta from '@/hooks/use-theme-color-meta';

interface ILink {
  label: string;
  href: string;
}

type Props = {
  anchors: ILink[];
} & ILanguagePickerProps;

const { anchors, langs } = defineProps<Props>();

const open = ref(false);

const { y } = useWindowScroll();
const isAtTop = computed(() => {
  return isServerSide ? true : Math.round(y.value / window.innerHeight) === 0;
});

const { updateThemeColor, reset } = useThemeColorMeta();

watchEffect(() => {
  if (isServerSide) return;
  if (open.value) {
    const color = window.getComputedStyle(document.body).backgroundColor;
    updateThemeColor(color);
  } else {
    reset();
  }
});
</script>

<style>
html {
  &:has(aside:not(.hidden)) {
    @apply overflow-hidden;
  }
}
</style>
