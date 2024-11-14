import I18NextVue from 'i18next-vue';
import type { Plugin } from 'vue';

import { initI18nextClient } from '.';

const i18next = await initI18nextClient();

export default {
  install: (app) => {
    app.use(I18NextVue, { i18next });
  },
} as Plugin;
