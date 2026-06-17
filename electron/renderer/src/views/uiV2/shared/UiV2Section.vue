<template>
  <section class="ui-v2-section">
    <header v-if="title || hint || $slots.actions" class="ui-v2-section__header">
      <div>
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="hint">{{ hint }}</p>
      </div>
      <div v-if="$slots.actions" class="ui-v2-section__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="ui-v2-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
})
</script>

<style scoped>
.ui-v2-section {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-16);
  background: var(--color-surface);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}

.ui-v2-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12);
  padding: 15px 16px 13px;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(249, 251, 250, 0.74));
}

.ui-v2-section h2 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-pc-section-title-size);
  line-height: var(--font-pc-section-title-line);
  font-weight: 820;
  letter-spacing: 0;
}

.ui-v2-section p {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.ui-v2-section__actions {
  display: flex;
  align-items: center;
  gap: var(--space-token-8);
}

.ui-v2-section__body {
  padding: 16px;
}
</style>
