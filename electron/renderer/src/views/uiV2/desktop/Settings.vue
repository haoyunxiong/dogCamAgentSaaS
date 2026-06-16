<template>
  <UiV2Page title="系统设置" description="入口型设置中心，展示配置状态；Demo 暂不展开复杂配置逻辑。">
    <section class="settings-layout">
      <div class="settings-list">
        <SettingsCard v-for="item in settings" :key="item.id" :group="item.group" :title="item.title" :desc="item.desc" :status="item.status" :variant="item.variant" @click="selectedId = item.id" />
      </div>
      <UiV2Section title="当前设置摘要" hint="正式配置逻辑将在后续 SaaS 底座阶段展开">
        <div v-if="selectedSetting" class="ui-v2-stack">
          <DrawerSummary :status="selectedSetting.status" :title="selectedSetting.title" :description="selectedSetting.desc" :meta="selectedSetting.group" primary-label="进入配置" secondary-label="查看说明" />
          <section class="ui-v2-detail-grid">
            <div v-for="field in selectedSetting.fields" :key="field.label">
              <span>{{ field.label }}</span>
              <strong>{{ field.value }}</strong>
            </div>
          </section>
          <p class="settings-note">这是 UI-V2 mock 配置入口，不读取或写入真实商家配置。</p>
        </div>
      </UiV2Section>
    </section>
  </UiV2Page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { DrawerSummary, SettingsCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const settings = uiV2MockAdapter.getSettings()
const selectedId = ref(settings[0]?.id || '')
const selectedSetting = computed(() => settings.find((item) => item.id === selectedId.value))
</script>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.42fr) minmax(0, 0.58fr);
  gap: var(--space-16);
  align-items: start;
}

.settings-list {
  display: grid;
  gap: var(--space-12);
}

.settings-note {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
