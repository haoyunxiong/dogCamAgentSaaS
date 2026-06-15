<template>
  <div class="skeleton-stack" :style="{ '--rows': rows }" aria-hidden="true">
    <span v-for="index in rows" :key="index" :class="['skeleton-line', `line-${index % 3}`]" />
  </div>
</template>

<script setup>
defineProps({
  rows: { type: Number, default: 3 }
})
</script>

<style scoped>
.skeleton-stack {
  display: grid;
  gap: var(--space-8);
}

.skeleton-line {
  height: 14px;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, #eef2f6 0%, #f7f9fb 48%, #eef2f6 100%);
  background-size: 220% 100%;
  animation: pulse 1.3s ease-in-out infinite;
}

.line-1 {
  width: 72%;
}

.line-2 {
  width: 96%;
}

.line-0 {
  width: 56%;
}

@keyframes pulse {
  from {
    background-position: 120% 0;
  }
  to {
    background-position: -120% 0;
  }
}
</style>
