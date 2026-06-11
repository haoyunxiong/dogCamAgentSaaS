<template>
  <section v-if="visible" class="batch-action-bar">
    <div class="batch-action-bar__left">
      <slot name="label">{{ label }}</slot>
    </div>
    <div class="batch-action-bar__right">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  label: { type: String, default: '' },
})
</script>

<style scoped>
.batch-action-bar {
  position: sticky;
  top: 12px;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(8px);
}

.batch-action-bar__left {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.batch-action-bar__right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
