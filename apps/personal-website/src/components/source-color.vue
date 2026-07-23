<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        id="source-color"
        class="ring-accent/80 ring-offset-3 block size-10 cursor-pointer rounded-full ring-4 duration-300"
        :style="{
          backgroundColor: $sourceColor.value,
        }"
        title="Source Color Picker"
      >
        <img
          :src="sourceImage"
          alt="source image"
          class="size-full rounded-full"
          v-if="sourceImage"
        />
      </button>
    </PopoverTrigger>
    <PopoverContent>
      <div class="space-y-2 px-4 py-2">
        <div
          v-if="showTheme"
          class="theme-seg bg-muted/60 flex gap-1 rounded-lg p-1"
        >
          <button
            type="button"
            data-theme-set="system"
            aria-label="System theme"
            title="System"
            class="flex-center flex-1 rounded-md py-1.5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
              <rect width="20" height="14" x="2" y="3" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </button>
          <button
            type="button"
            data-theme-set="light"
            aria-label="Light theme"
            title="Light"
            class="flex-center flex-1 rounded-md py-1.5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          </button>
          <button
            type="button"
            data-theme-set="dark"
            aria-label="Dark theme"
            title="Dark"
            class="flex-center flex-1 rounded-md py-1.5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          </button>
        </div>
        <div class="relative">
          <label
            for="source-color-image"
            :style="{
              borderColor: $sourceColor.value,
              color: $sourceColor.value,
            }"
            class="flex-center aspect-square w-full cursor-pointer rounded border"
            title="Source Image"
          >
            <img
              :src="sourceImage"
              alt="source image"
              class="peer size-full object-cover"
              v-if="sourceImage"
            />
            <ImageIcon v-else class="size-12" />
          </label>
          <input
            type="file"
            name="source-color-image"
            id="source-color-image"
            accept="image/*"
            @change="handleImageChange"
            class="sr-only inset-4 size-auto"
          />
        </div>
        <div class="relative">
          <label
            for="source-color-picker"
            class="block h-6 w-full cursor-pointer rounded"
            :style="{ backgroundColor: $sourceColor.value }"
            title="Source Color"
          ></label>
          <input
            type="color"
            name="source-color-picker"
            id="source-color-picker"
            v-model="sourceColor"
            @change="handleColorChange"
            class="sr-only inset-0 size-auto"
          />
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
<script lang="ts" setup>
import { hexFromArgb } from '@material/material-color-utilities';
import { useVModel } from '@nanostores/vue';
import { sourceColorFromImageBytes } from '@rainforest-dev/rainforest-ui';
import { $sourceColor } from '@stores';
import { useLocalStorage } from '@vueuse/core';
import { ImageIcon } from '@lucide/vue';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// `showTheme` renders a System/Light/Dark segmented control inside the picker —
// enabled on shell-less pages (home) so they get a theme switch without the header.
// Clicks are handled by the inline head script via the shared data-theme-set hook.
defineProps<{ showTheme?: boolean }>();

const sourceColor = useVModel($sourceColor);
const sourceImage = useLocalStorage('source-image', '');

const reload = () => location.reload();

const handleColorChange = () => {
  if (sourceImage.value) sourceImage.value = '';
  reload();
};

const handleImageChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async () => {
      sourceImage.value = reader.result as string;

      const img = new Image();
      img.src = sourceImage.value;
      await new Promise((resolve) => (img.onload = resolve));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const imageData = ctx?.getImageData(0, 0, img.width, img.height);
      if (!imageData) return;
      const argb = sourceColorFromImageBytes(imageData.data);
      const color = hexFromArgb(argb);
      if (color && color !== sourceColor.value) {
        sourceColor.value = color;
        reload();
      }
    };
    reader.readAsDataURL(file);
  }
};
</script>
