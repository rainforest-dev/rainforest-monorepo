<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
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
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <div class="space-y-2 px-4 py-2">
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
    </DropdownMenuContent>
  </DropdownMenu>
</template>
<script lang="ts" setup>
import { hexFromArgb } from '@material/material-color-utilities';
import { useVModel } from '@nanostores/vue';
import { sourceColorFromImageBytes } from '@rainforest-dev/rainforest-ui';
import { $sourceColor } from '@stores';
import { useLocalStorage } from '@vueuse/core';
import { ImageIcon } from '@lucide/vue';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
