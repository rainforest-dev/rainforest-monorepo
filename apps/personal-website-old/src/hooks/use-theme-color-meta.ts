import { usePreferredDark } from '@vueuse/core';
import { computed, ref, watch } from 'vue';

export default function useThemeColorMeta() {
  const isDark = usePreferredDark();
  const media = computed(
    () => `(prefers-color-scheme: ${isDark.value ? 'dark' : 'light'})`
  );
  const snapshot = ref<string>();
  const metaRef = ref<HTMLMetaElement>();

  watch(media, () => {
    reset();
    metaRef.value = undefined;
    snapshot.value = undefined;
  });

  const updateThemeColor = (color: string) => {
    const metaTag = document.querySelector(
      `meta[name="theme-color"][media="${media.value}"]`
    ) as HTMLMetaElement;
    if (metaRef.value !== metaTag) {
      metaRef.value = metaTag;
    }
    if (!metaRef.value) {
      const newMetaTag = document.createElement('meta');
      newMetaTag.setAttribute('name', 'theme-color');
      newMetaTag.setAttribute('content', color);
      if (media) {
        newMetaTag.setAttribute('media', media.value);
      }
      document.head.appendChild(newMetaTag);
      metaRef.value = newMetaTag;
    } else {
      if (!snapshot.value) snapshot.value = metaRef.value.content;
      metaRef.value.setAttribute('content', color);
    }
  };

  const reset = () => {
    if (snapshot.value) {
      if (metaRef.value) {
        metaRef.value.setAttribute('content', snapshot.value);
      }
    } else {
      if (metaRef.value) {
        document.head.removeChild(metaRef.value);
      }
    }
  };

  return {
    updateThemeColor,
    reset,
  };
}
