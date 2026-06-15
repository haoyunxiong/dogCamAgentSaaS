<template>
  <Teleport to="body">
    <div v-if="open" class="drawer-layer" @click.self="$emit('close')">
      <aside class="drawer" :style="{ width }">
        <header class="drawer-header">
          <div>
            <h2>{{ title }}</h2>
            <p v-if="description">{{ description }}</p>
          </div>
          <button class="close-button" type="button" aria-label="关闭" @click="$emit('close')">×</button>
        </header>
        <div class="drawer-body">
          <slot />
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  width: { type: String, default: '620px' }
})

defineEmits(['close'])
</script>

<style scoped>
.drawer-layer {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(16, 24, 40, 0.22);
  display: flex;
  justify-content: flex-end;
}

.drawer {
  max-width: calc(100vw - 32px);
  height: 100vh;
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-drawer);
  display: grid;
  grid-template-rows: auto 1fr;
}

.drawer-header {
  padding: var(--space-20);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-16);
  border-bottom: 1px solid var(--border);
}

.drawer-header h2 {
  margin: 0;
  font-size: var(--font-pc-section-title-size);
  line-height: var(--font-pc-section-title-line);
}

.drawer-header p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.drawer-body {
  min-height: 0;
  overflow: auto;
  padding: var(--space-20);
}

.close-button {
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
  color: var(--text-soft);
  width: 32px;
  height: 32px;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 18px;
}
</style>
