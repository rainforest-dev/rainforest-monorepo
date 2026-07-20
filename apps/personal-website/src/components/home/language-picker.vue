<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" aria-label="language-picker">
        <Globe
          :class="
            clsx(
              'text-muted-foreground xl:text-foreground',
              !isAtTop ? 'md:text-foreground' : 'md:text-background',
            )
          "
        />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem
        v-for="{ label, href, key } in langs"
        :key="key"
        as-child
      >
        <a :href="href" @click="cacheLocale(key)">{{ label }}</a>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
<script lang="ts" setup>
import { isServerSide, persistentLocaleKey } from '@utils';
import { useWindowScroll } from '@vueuse/core';
import clsx from 'clsx';
import Cookies from 'js-cookie';
import { Globe } from '@lucide/vue';
import { computed } from 'vue';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ILink {
  key: string;
  label: string;
  href: string;
}
export interface IProps {
  langs: ILink[];
}

const { langs } = defineProps<IProps>();

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
