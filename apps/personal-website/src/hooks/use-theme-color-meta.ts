import { usePreferredColorScheme } from '@vueuse/core';
import { ref } from 'vue';

export default function useThemeColorMeta() {
  const preferredColor = usePreferredColorScheme();
  const media =
    preferredColor.value === 'no-preference'
      ? ''
      : `(prefers-color-scheme: ${preferredColor.value})`;
  const snapshot = ref<string>();
  const metaRef = ref<HTMLMetaElement>();

  const updateThemeColor = (color: string) => {
    metaRef.value = document.querySelector(
      `meta[name="theme-color"][media="${media}"]`
    ) as HTMLMetaElement;
    if (!metaRef.value) {
      const newMetaTag = document.createElement('meta');
      newMetaTag.setAttribute('name', 'theme-color');
      newMetaTag.setAttribute('content', color);
      if (media) {
        newMetaTag.setAttribute('media', media);
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
