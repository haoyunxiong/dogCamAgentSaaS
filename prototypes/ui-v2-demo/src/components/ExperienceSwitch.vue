<template>
  <div class="experience-switch" role="group" aria-label="体验版本切换">
    <button
      v-for="item in variants"
      :key="item.key"
      :class="{ active: variant === item.key }"
      type="button"
      :title="item.description"
      @click="switchVariant(item.key)"
    >
      <span>{{ item.label }}</span>
      <strong>{{ item.shortName }}</strong>
    </button>
  </div>
</template>

<script setup>
import { useExperienceVariant } from '../composables/useExperienceVariant.js'

const { variant, variants, switchVariant } = useExperienceVariant()
</script>

<style scoped>
.experience-switch {
  height: 34px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.experience-switch button {
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 760;
}

.experience-switch button:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--brand-soft) 54%, transparent);
}

.experience-switch button.active {
  color: var(--brand-strong);
  background: var(--brand-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand) 18%, transparent);
}

.experience-switch span {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  display: inline-grid;
  place-items: center;
  background: color-mix(in srgb, var(--brand) 12%, transparent);
  font-size: 10px;
}

.experience-switch strong {
  font-size: 11px;
}
</style>
