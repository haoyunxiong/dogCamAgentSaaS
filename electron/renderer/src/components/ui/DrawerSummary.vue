<template>
  <section class="drawer-summary">
    <div class="drawer-summary__copy">
      <StatusBadge v-if="status" :label="status" :variant="statusVariant" size="sm" />
      <h3>{{ title }}</h3>
      <p v-if="description">{{ description }}</p>
      <small v-if="meta">{{ meta }}</small>
    </div>
    <div v-if="hasActions" class="drawer-summary__actions">
      <slot name="actions">
        <BaseButton v-if="dangerLabel" variant="danger" size="sm" @click="$emit('danger')">
          {{ dangerLabel }}
        </BaseButton>
        <BaseButton v-if="secondaryLabel" variant="secondary" size="sm" @click="$emit('secondary')">
          {{ secondaryLabel }}
        </BaseButton>
        <BaseButton v-if="primaryLabel" variant="primary" size="sm" @click="$emit('primary')">
          {{ primaryLabel }}
        </BaseButton>
      </slot>
    </div>
  </section>
</template>

<script setup>
import { computed, useSlots } from 'vue'
import BaseButton from '../BaseButton.vue'
import StatusBadge from '../StatusBadge.vue'

const props = defineProps({
  status: { type: String, default: '' },
  statusVariant: { type: String, default: 'info' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  meta: { type: String, default: '' },
  primaryLabel: { type: String, default: '' },
  secondaryLabel: { type: String, default: '' },
  dangerLabel: { type: String, default: '' },
})

defineEmits(['primary', 'secondary', 'danger'])

const slots = useSlots()
const hasActions = computed(() => props.primaryLabel || props.secondaryLabel || props.dangerLabel || slots.actions)
</script>

<style scoped>
.drawer-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--ui-space-16);
  align-items: start;
  padding: var(--ui-space-16);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: linear-gradient(135deg, var(--ui-surface), var(--ui-surface-soft));
  box-shadow: var(--shadow-subtle);
}

.drawer-summary__copy {
  min-width: 0;
}

.drawer-summary h3 {
  margin: var(--ui-space-8) 0 var(--ui-space-4);
  color: var(--ui-text);
  font-size: 18px;
  line-height: 26px;
}

.drawer-summary p,
.drawer-summary small {
  display: block;
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.drawer-summary small {
  margin-top: var(--ui-space-4);
}

.drawer-summary__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ui-space-8);
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .drawer-summary {
    grid-template-columns: 1fr;
  }

  .drawer-summary__actions {
    justify-content: flex-start;
  }
}
</style>
