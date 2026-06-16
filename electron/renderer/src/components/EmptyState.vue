<template>
  <div class="empty-state" :class="[`state-${state}`, { compact, inline: variant === 'inline' }]">
    <div class="es-icon" :class="`tone-${resolvedTone}`">
      <span v-if="resolvedIcon">{{ resolvedIcon }}</span>
      <span v-else>—</span>
    </div>
    <div class="es-title">{{ resolvedTitle }}</div>
    <div v-if="resolvedHint" class="es-hint">{{ resolvedHint }}</div>
    <div v-if="$slots.default" class="es-actions">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: {
    type: String,
    default: 'empty',
    validator: (v) => ['empty', 'loading', 'error', 'permission', 'no-result'].includes(v),
  },
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
  icon: { type: String, default: '' },
  tone: { type: String, default: '' }, // neutral | primary | warning | success | danger
  compact: { type: Boolean, default: false },
  variant: { type: String, default: 'block' }, // block | inline
})

const STATE_META = {
  empty: { icon: '—', title: '暂无数据', tone: 'neutral' },
  loading: { icon: '…', title: '加载中', hint: '请稍候，正在获取最新数据。', tone: 'primary' },
  error: { icon: '!', title: '加载失败', hint: '请检查网络或稍后重试。', tone: 'danger' },
  permission: { icon: 'lock', title: '暂无权限', hint: '请联系管理员开通对应权限。', tone: 'warning' },
  'no-result': { icon: '—', title: '无搜索结果', hint: '换个关键词或清空筛选条件。', tone: 'neutral' },
}

const meta = computed(() => STATE_META[props.state] || STATE_META.empty)
const resolvedIcon = computed(() => props.icon || meta.value.icon)
const resolvedTitle = computed(() => props.title || meta.value.title)
const resolvedHint = computed(() => props.hint || meta.value.hint)
const resolvedTone = computed(() => props.tone || meta.value.tone)
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 24px;
  text-align: center;
  color: var(--color-text-muted, #6b7280);
}
.empty-state.compact { padding: 24px 16px; gap: 6px; }
.empty-state.inline { padding: 16px; }

.es-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: var(--bg-subtle, #f3f4f6);
  box-shadow: var(--shadow-subtle, 0 1px 2px rgba(16, 24, 40, 0.04));
  margin-bottom: 4px;
}
.empty-state.compact .es-icon { width: 44px; height: 44px; font-size: 22px; border-radius: 14px; }

.tone-primary  { background: var(--brand-primary-soft, #e8f7f3); color: var(--color-primary, #007f6d); }
.tone-warning  { background: var(--color-warning-soft, #fffbeb); }
.tone-success  { background: var(--color-success-soft, #f0fdf4); }
.tone-danger   { background: var(--color-danger-soft, #fef2f2); }

.es-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text, #111827);
}
.es-hint {
  font-size: 13px;
  color: var(--color-text-muted, #6b7280);
  max-width: 420px;
  line-height: 1.6;
}
.es-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
