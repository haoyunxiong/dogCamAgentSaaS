<template>
  <section class="address-card">
    <div class="address-card__head">
      <div class="address-card__title-wrap">
        <span class="address-card__dot" :class="`tone-${tone}`"></span>
        <h4 class="address-card__title">{{ title }}</h4>
      </div>
      <div v-if="$slots.actions" class="address-card__actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="address-card__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  tone: { type: String, default: 'primary' },
})
</script>

<style scoped>
.address-card {
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 12px;
  padding: 12px;
  min-height: 208px;
  background: #fff;
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}

.address-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.address-card__title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.address-card__title {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary, #111827);
}

.address-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  display: inline-block;
}

.tone-primary {
  background: #0f766e;
}

.tone-info {
  background: #2563eb;
}

.tone-warning {
  background: #d97706;
}

.tone-danger {
  background: #dc2626;
}

.address-card__body {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
}
</style>
