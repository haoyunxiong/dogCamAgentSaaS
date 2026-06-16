<template>
  <section class="insight-panel">
    <header>
      <h3>{{ title }}</h3>
      <StatusBadge v-if="tag" :label="tag" variant="info" size="sm" />
    </header>
    <ul>
      <li v-for="item in items" :key="item.title">
        <span class="insight-panel__dot" aria-hidden="true" />
        <strong>{{ item.title }}</strong>
        <p>{{ item.desc || item.description }}</p>
      </li>
    </ul>
  </section>
</template>

<script setup>
import StatusBadge from '../StatusBadge.vue'

defineProps({
  title: { type: String, default: '经营洞察' },
  tag: { type: String, default: 'Mock' },
  items: { type: Array, default: () => [] },
})
</script>

<style scoped>
.insight-panel {
  padding: var(--ui-space-16);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  box-shadow: var(--shadow-card);
  display: grid;
  gap: var(--ui-space-12);
}

.insight-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.insight-panel h3 {
  margin: 0;
  color: var(--ui-text);
  font-size: 16px;
}

.insight-panel ul {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  list-style: none;
}

.insight-panel li {
  position: relative;
  overflow: hidden;
  padding: var(--ui-space-12);
  border-radius: var(--radius-8);
  background: var(--ui-surface-soft);
}

.insight-panel__dot {
  position: absolute;
  left: 0;
  top: var(--ui-space-12);
  width: 3px;
  height: 24px;
  border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
  background: var(--ui-brand);
}

.insight-panel strong {
  display: block;
  color: var(--ui-text);
  font-size: 13px;
}

.insight-panel p {
  margin: var(--ui-space-4) 0 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 1.5;
}
</style>
