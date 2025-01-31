<script lang="ts" setup>
import { MdTabs } from '@material/web/tabs/tabs';
import { MdPrimaryTab } from '@material/web/tabs/primary-tab';
import '@material/web/icon/icon';
import '@rainforest-dev/rainforest-ui/lit/design-system/colors';
import '@rainforest-dev/rainforest-ui/lit/design-system/typography';
import { ref, useTemplateRef } from 'vue';

const panels = useTemplateRef<HTMLElement>('panels');
const currentPanel = ref<HTMLElement | null>(null);

const getPanelByTab = (tab: MdPrimaryTab | null) => {
  if (!tab) return null;
  const panelId = tab.getAttribute('aria-controls');
  return panels.value?.querySelector(
    '[title=' + panelId + ']'
  ) as HTMLElement | null;
};

const handleTabChange = (event: Event) => {
  const tabs = event.target as MdTabs;
  const previousPanel = tabs.activeTab?.previousElementSibling
    ? getPanelByTab(
        tabs.activeTab?.previousElementSibling as MdPrimaryTab | null
      )
    : currentPanel.value;
  if (previousPanel) {
    previousPanel.hidden = true;
  }
  currentPanel.value = getPanelByTab(tabs.activeTab as MdPrimaryTab | null);
  if (currentPanel.value) {
    currentPanel.value.hidden = false;
  }
};
</script>

<template>
  <md-tabs @change="handleTabChange">
    <md-primary-tab aria-controls="panel-colors"> Colors </md-primary-tab>
    <md-primary-tab aria-controls="panel-typography">
      Typography
    </md-primary-tab>
  </md-tabs>
  <div ref="panels" class="py-10">
    <rf-design-system-colors
      role="tabpanel"
      title="panel-colors"
      aria-labelledby="tab-colors"
    />
    <rf-design-system-typography
      role="tabpanel"
      title="panel-typography"
      aria-labelledby="tab-typography"
      hidden
    />
  </div>
</template>
