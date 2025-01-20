import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onRegisteredSW(swScriptUrl) {
    console.log('SW registered: ', swScriptUrl);
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});
