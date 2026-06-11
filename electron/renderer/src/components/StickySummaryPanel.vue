<template>
  <aside class="sticky-summary-panel">
    <div class="sticky-summary-panel__head">
      <slot name="title">
        <h3 class="sticky-summary-panel__title">{{ title }}</h3>
      </slot>
    </div>
    <div class="sticky-summary-panel__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="sticky-summary-panel__footer">
      <slot name="footer" />
    </div>
  </aside>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
})
</script>

<style scoped>
.sticky-summary-panel {
  position: sticky;
  top: 12px;
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 12px;
  background: #fff;
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}

.sticky-summary-panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.sticky-summary-panel__body {
  display: grid;
  gap: 12px;
}

.sticky-summary-panel__footer {
  display: grid;
  gap: 8px;
}
</style>
