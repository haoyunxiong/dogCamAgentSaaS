<template>
  <Teleport to="body">
    <div v-if="open" class="sheet-layer" @click.self="$emit('close')">
      <section class="sheet">
        <div class="sheet-handle" aria-hidden="true" />
        <header class="sheet-header">
          <h2>{{ title }}</h2>
          <button type="button" @click="$emit('close')">完成</button>
        </header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '筛选' }
})

defineEmits(['close'])
</script>

<style scoped>
.sheet-layer {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(16, 24, 40, 0.28);
}

.sheet {
  width: min(430px, 100vw);
  max-height: 76vh;
  overflow: auto;
  background: var(--surface);
  border-radius: var(--radius-16) var(--radius-16) 0 0;
  padding: 10px var(--space-16) var(--space-24);
  box-shadow: var(--shadow-drawer);
}

.sheet-handle {
  width: 40px;
  height: 4px;
  margin: 0 auto 12px;
  border-radius: 999px;
  background: var(--border-strong);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-12);
}

.sheet-header h2 {
  margin: 0;
  font-size: var(--font-mobile-card-title-size);
  line-height: var(--font-mobile-card-title-line);
}

.sheet-header button {
  border: 0;
  background: transparent;
  color: var(--brand);
  font-weight: 760;
}
</style>
