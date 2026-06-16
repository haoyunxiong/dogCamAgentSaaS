<template>
  <div class="ui-v2-page">
    <header class="ui-v2-page__header">
      <div>
        <span v-if="eyebrow" class="ui-v2-page__eyebrow">{{ eyebrow }}</span>
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ui-v2-page__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: 'UI-V2 Mock' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

<style scoped>
.ui-v2-page {
  display: grid;
  gap: var(--space-16);
}

.ui-v2-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-16);
  padding-top: 2px;
}

.ui-v2-page__eyebrow {
  display: inline-flex;
  margin-bottom: var(--space-token-4);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 760;
}

.ui-v2-page h1 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-pc-page-title-size);
  line-height: var(--font-pc-page-title-line);
  font-weight: 760;
}

.ui-v2-page p {
  margin: var(--space-token-4) 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

.ui-v2-page__actions {
  display: flex;
  align-items: center;
  gap: var(--space-token-8);
  flex-wrap: wrap;
}
</style>
