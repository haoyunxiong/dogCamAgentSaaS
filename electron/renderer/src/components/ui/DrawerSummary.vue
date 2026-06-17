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
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-16);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(242, 248, 246, 0.9)),
    var(--ui-surface);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.drawer-summary__copy {
  min-width: 0;
}

.drawer-summary h3 {
  margin: var(--ui-space-8) 0 var(--ui-space-4);
  color: var(--ui-text);
  font-size: 19px;
  line-height: 27px;
  letter-spacing: 0;
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
  max-width: 260px;
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
