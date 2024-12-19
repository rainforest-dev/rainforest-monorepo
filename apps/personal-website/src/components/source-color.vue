<template>
  <div class="relative">
    <button
      id="source-color"
      class="size-10 block rounded-full ring-4 ring-tertiary/80 ring-offset-3 duration-300 cursor-pointer"
      @click="toggleMenu"
      :style="{
        backgroundColor: $sourceColor.value,
      }"
    >
      <img
        :src="sourceImage"
        alt="source image"
        class="size-full rounded-full [[src='']]:hidden"
      />
    </button>
    <md-menu ref="menu" id="source-color-menu" anchor="source-color">
      <div class="px-4 py-2 space-y-2">
        <div class="relative">
          <label
            for="source-color-image"
            :style="{
              borderColor: $sourceColor.value,
            }"
            class="w-full aspect-square block cursor-pointer border rounded"
          >
            <img
              :src="sourceImage"
              alt="source image"
              class="object-cover size-full [[src='']]:hidden"
            />
          </label>
          <input
            type="file"
            name="source-color-image"
            id="source-color-image"
            accept="image/*"
            @change="handleImageChange"
            class="sr-only size-auto inset-4"
          />
        </div>
        <div class="relative">
          <label
            for="source-color-picker"
            class="w-full h-6 block cursor-pointer rounded"
            :style="{ backgroundColor: $sourceColor.value }"
          ></label>
          <input
            type="color"
            name="source-color-picker"
            id="source-color-picker"
            v-model="sourceColor"
            @change="handleColorChange"
            class="sr-only size-auto inset-0"
          />
        </div>
      </div>
    </md-menu>
  </div>
</template>
<script lang="ts" setup>
import { hexFromArgb } from '@material/material-color-utilities';
import '@material/web/menu/menu';
import { MdMenu } from '@material/web/menu/menu';
import '@material/web/menu/menu-item';
import { useVModel } from '@nanostores/vue';
import { sourceColorFromImageBytes } from '@rainforest-dev/rainforest-ui';
import { $sourceColor } from '@stores';
import { useLocalStorage } from '@vueuse/core';
import { useTemplateRef } from 'vue';

const menu = useTemplateRef<MdMenu>('menu');
const toggleMenu = () => {
  if (menu.value) menu.value.open = !menu.value.open;
};
const sourceColor = useVModel($sourceColor);
const sourceImage = useLocalStorage('source-image', '');
console.log(sourceImage.value);

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
