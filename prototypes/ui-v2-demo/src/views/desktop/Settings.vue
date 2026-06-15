<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">系统设置</h1>
          <p class="page-desc">集中查看商家、门店、履约和风控配置项。</p>
        </div>
        <BaseButton variant="secondary">查看变更记录</BaseButton>
      </header>

      <section class="settings-layout">
        <div class="settings-cards">
          <SettingsCard
            v-for="item in settingsGroups"
            :key="item.id"
            :group="item.group"
            :title="item.title"
            :desc="item.desc"
            :status="item.status"
            :tone="statusTone(item.status)"
            @click="active = item"
          />
        </div>

        <section class="settings-form panel">
          <div class="panel-header">
            <div>
              <StatusTag :label="active.status" :tone="statusTone(active.status)" />
              <h2>{{ active.title }}</h2>
              <p>{{ active.desc }}</p>
            </div>
            <ToggleSwitch v-model="activeEnabled" />
          </div>

          <div class="panel-body form-body">
            <BaseInput
              v-for="field in active.fields"
              :key="field.label"
              :label="field.label"
              :model-value="field.value"
              disabled
            />
            <section class="setting-note">
              <strong>配置说明</strong>
              <p>{{ active.note }}</p>
            </section>
          </div>

          <footer class="save-bar">
            <span>有未保存更改</span>
            <div class="row">
              <BaseButton variant="secondary">取消</BaseButton>
              <BaseButton>保存更改</BaseButton>
            </div>
          </footer>
        </section>
      </section>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseInput from '../../components/BaseInput.vue'
import SettingsCard from '../../components/SettingsCard.vue'
import StatusTag from '../../components/StatusTag.vue'
import ToggleSwitch from '../../components/ToggleSwitch.vue'
import { settingsGroups } from '../../mock/settings.js'

const active = ref(settingsGroups[0])
const toggles = ref(Object.fromEntries(settingsGroups.map((item) => [item.id, item.enabled])))
const activeEnabled = computed({
  get: () => Boolean(toggles.value[active.value.id]),
  set: (value) => {
    toggles.value[active.value.id] = value
  }
})

function statusTone(status) {
  return { 已配置: 'success', 未配置: 'neutral', 需处理: 'warning' }[status] || 'neutral'
}
</script>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: var(--space-16);
  align-items: start;
}

.settings-cards {
  display: grid;
  gap: var(--space-12);
}

.settings-form {
  min-height: 650px;
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.panel-header h2 {
  margin: var(--space-12) 0 var(--space-4);
  font-size: 24px;
}

.panel-header p {
  margin: 0;
  color: var(--text-muted);
}

.form-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: var(--space-12);
}

.setting-note {
  grid-column: 1 / -1;
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface-soft);
}

.setting-note p {
  margin: var(--space-4) 0 0;
  color: var(--text-muted);
}

.save-bar {
  padding: var(--space-12) var(--space-16);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  background: var(--surface);
}

.save-bar span {
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}

@media (max-width: 1120px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
}
</style>
