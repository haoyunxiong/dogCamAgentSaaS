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
  eyebrow: { type: String, default: '本地租赁运营' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

<style scoped>
.ui-v2-page {
  display: grid;
  gap: 14px;
  padding: 0 0 18px;
}

.ui-v2-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-16);
  padding: 0 2px 0;
}

.ui-v2-page__eyebrow { display: none; }

.ui-v2-page h1 {
  margin: 0;
  color: var(--color-text);
  font-size: 26px;
  line-height: 34px;
  font-weight: 820;
  letter-spacing: 0;
}

.ui-v2-page p {
  margin: 2px 0 0;
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
