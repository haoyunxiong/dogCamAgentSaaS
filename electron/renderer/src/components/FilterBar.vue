<template>
  <section class="filter-bar">
    <div v-if="title || hint || $slots.actions" class="filter-bar__head">
      <div v-if="title || hint" class="filter-bar__copy">
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="hint">{{ hint }}</p>
      </div>
      <div v-if="$slots.actions" class="filter-bar__actions">
        <slot name="actions" />
      </div>
    </div>

    <div class="filter-bar__body">
      <slot />
    </div>

    <div v-if="$slots.advanced" v-show="showAdvanced" class="filter-bar__advanced">
      <slot name="advanced" />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
  showAdvanced: { type: Boolean, default: false },
})
</script>

<style scoped>
.filter-bar {
  display: grid;
  gap: var(--space-12, 12px);
  padding: var(--space-12, 12px) var(--space-16, 16px);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-12, 12px);
  background: var(--color-surface, #fff);
}

.filter-bar__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.filter-bar__copy h3 {
  margin: 0;
  font-size: 15px;
  color: var(--color-text, #111827);
}

.filter-bar__copy p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-muted, #6b7280);
}

.filter-bar__body,
.filter-bar__advanced {
  display: grid;
  gap: 12px;
}

.filter-bar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .filter-bar__head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
