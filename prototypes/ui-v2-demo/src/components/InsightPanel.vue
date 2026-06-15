<template>
  <section class="insight-panel">
    <header>
      <h3>{{ title }}</h3>
      <StatusTag label="Mock" tone="info" />
    </header>
    <ul>
      <li v-for="item in items" :key="item.title">
        <strong>{{ item.title }}</strong>
        <p>{{ item.desc }}</p>
      </li>
    </ul>
  </section>
</template>

<script setup>
import StatusTag from './StatusTag.vue'

defineProps({
  title: { type: String, default: '经营洞察' },
  items: { type: Array, default: () => [] }
})
</script>

<style scoped>
.insight-panel {
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
  display: grid;
  gap: var(--space-12);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h3 {
  margin: 0;
  font-size: 16px;
}

ul {
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-10, 10px);
  list-style: none;
}

li {
  padding: var(--space-12);
  border-radius: var(--radius-8);
  background: var(--surface-soft);
}

strong {
  display: block;
  color: var(--text);
  font-size: 13px;
}

p {
  margin: var(--space-4) 0 0;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
