<template>
  <div class="empty-state" :class="{ compact, inline: variant === 'inline' }">
    <div class="es-icon" :class="`tone-${tone}`">
      <span v-if="icon">{{ icon }}</span>
      <span v-else>📭</span>
    </div>
    <div class="es-title">{{ title }}</div>
    <div v-if="hint" class="es-hint">{{ hint }}</div>
    <div v-if="$slots.default" class="es-actions">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '暂无数据' },
  hint: { type: String, default: '' },
  icon: { type: String, default: '' },
  tone: { type: String, default: 'neutral' }, // neutral | primary | warning | success
  compact: { type: Boolean, default: false },
  variant: { type: String, default: 'block' }, // block | inline
})
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
  color: var(--color-text-secondary, #64748b);
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
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
  margin-bottom: 4px;
}
.empty-state.compact .es-icon { width: 44px; height: 44px; font-size: 22px; border-radius: 14px; }

.tone-primary  { background: var(--color-info-soft, #eff6ff); }
.tone-warning  { background: var(--color-warning-soft, #fffbeb); }
.tone-success  { background: var(--color-success-soft, #f0fdf4); }

.es-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text, #1f2937);
}
.es-hint {
  font-size: 13px;
  color: var(--color-text-muted, #94a3b8);
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
