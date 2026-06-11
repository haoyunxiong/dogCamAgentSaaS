<template>
  <div class="kpi-strip">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="kpi-strip__item"
      :class="[item.tone ? `tone-${item.tone}` : '', { active: activeKey === item.key, emphasis: item.emphasis }]"
      @click="$emit('select', item.key)"
    >
      <span class="kpi-strip__label">{{ item.label }}</span>
      <strong class="kpi-strip__value">{{ item.value }}</strong>
      <span v-if="item.hint" class="kpi-strip__hint">{{ item.hint }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  activeKey: { type: String, default: '' },
})

defineEmits(['select'])
</script>

<style scoped>
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.kpi-strip__item {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  text-align: left;
  border-radius: 12px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  background: #fff;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.kpi-strip__item:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
}

.kpi-strip__item.active {
  border-color: rgba(15, 118, 110, 0.24);
  background: rgba(230, 246, 243, 0.72);
}

.kpi-strip__item.emphasis {
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.02);
}

.kpi-strip__label {
  font-size: 12px;
  color: var(--text-secondary, #4b5563);
}

.kpi-strip__value {
  font-size: 24px;
  line-height: 1;
  color: var(--text-primary, #111827);
}

.kpi-strip__hint {
  font-size: 12px;
  color: var(--text-tertiary, #6b7280);
}

.tone-warning.active {
  border-color: rgba(217, 119, 6, 0.24);
  background: rgba(255, 251, 235, 0.92);
}

.tone-warning.emphasis {
  border-color: rgba(217, 119, 6, 0.28);
  background: rgba(255, 251, 235, 0.92);
}

.tone-success.active {
  border-color: rgba(22, 163, 74, 0.24);
  background: rgba(240, 253, 244, 0.92);
}

.tone-danger.active {
  border-color: rgba(220, 38, 38, 0.24);
  background: rgba(254, 242, 242, 0.92);
}

.tone-danger.emphasis {
  border-color: rgba(220, 38, 38, 0.28);
  background: rgba(254, 242, 242, 0.96);
}

.tone-info.active {
  border-color: rgba(37, 99, 235, 0.2);
  background: rgba(239, 246, 255, 0.92);
}
</style>
