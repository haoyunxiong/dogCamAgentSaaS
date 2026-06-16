<template>
  <section class="drawer-summary">
    <div class="summary-copy">
      <StatusTag v-if="status" :label="status" :tone="statusTone" />
      <h3>{{ title }}</h3>
      <p v-if="description">{{ description }}</p>
      <small v-if="meta">{{ meta }}</small>
    </div>
    <div v-if="primaryLabel || secondaryLabel || dangerLabel || $slots.actions" class="summary-actions">
      <slot name="actions">
        <BaseButton v-if="dangerLabel" variant="danger" size="sm" @click="$emit('danger')">{{ dangerLabel }}</BaseButton>
        <BaseButton v-if="secondaryLabel" variant="secondary" size="sm" @click="$emit('secondary')">{{ secondaryLabel }}</BaseButton>
        <BaseButton v-if="primaryLabel" size="sm" @click="$emit('primary')">{{ primaryLabel }}</BaseButton>
      </slot>
    </div>
  </section>
</template>

<script setup>
import BaseButton from './BaseButton.vue'
import StatusTag from './StatusTag.vue'

defineProps({
  status: { type: String, default: '' },
  statusTone: { type: String, default: 'info' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  meta: { type: String, default: '' },
  primaryLabel: { type: String, default: '' },
  secondaryLabel: { type: String, default: '' },
  dangerLabel: { type: String, default: '' }
})

defineEmits(['primary', 'secondary', 'danger'])
</script>

<style scoped>
.drawer-summary {
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background:
    linear-gradient(135deg, var(--surface), var(--surface-soft));
  box-shadow: var(--shadow-subtle);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-16);
  align-items: start;
}

.summary-copy {
  min-width: 0;
}

h3 {
  margin: var(--space-10, 10px) 0 var(--space-4);
  color: var(--text);
  font-size: 18px;
  line-height: 26px;
}

p,
small {
  display: block;
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 20px;
}

small {
  margin-top: var(--space-4);
}

.summary-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-8);
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .drawer-summary {
    grid-template-columns: 1fr;
  }

  .summary-actions {
    justify-content: flex-start;
  }
}
</style>
