<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="bottom-sheet-layer"
      :data-testid="`${testId}-overlay`"
      @click.self="close"
    >
      <section
        class="bottom-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        :data-testid="`${testId}-panel`"
      >
        <div class="bottom-sheet__handle" aria-hidden="true" />
        <header class="bottom-sheet__header">
          <h2>{{ title }}</h2>
          <button
            type="button"
            :aria-label="`关闭${title}`"
            :data-testid="`${testId}-close`"
            @click="close"
          >
            {{ closeText }}
          </button>
        </header>
        <div class="bottom-sheet__body">
          <slot />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
  title: { type: String, default: '筛选' },
  closeText: { type: String, default: '完成' },
  testId: { type: String, default: 'bottom-sheet' },
})

const emit = defineEmits(['update:modelValue', 'close'])

const isOpen = computed(() => props.modelValue || props.open)

function close() {
  emit('update:modelValue', false)
  emit('close')
}
</script>

<style scoped>
.bottom-sheet-layer {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(16, 24, 40, 0.28);
}

.bottom-sheet {
  width: min(430px, 100vw);
  max-height: 76vh;
  overflow: auto;
  background: var(--ui-surface);
  border-radius: var(--radius-16) var(--radius-16) 0 0;
  padding: 10px var(--ui-space-16) var(--ui-space-24);
  box-shadow: var(--shadow-drawer);
}

.bottom-sheet__handle {
  width: 40px;
  height: 4px;
  margin: 0 auto var(--ui-space-12);
  border-radius: var(--radius-pill);
  background: var(--ui-border-strong);
}

.bottom-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-12);
  margin-bottom: var(--ui-space-12);
}

.bottom-sheet__header h2 {
  margin: 0;
  color: var(--ui-text);
  font-size: var(--font-mobile-card-title-size);
  line-height: var(--font-mobile-card-title-line);
}

.bottom-sheet__header button {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--ui-brand);
  font-weight: 760;
}

.bottom-sheet__body {
  display: grid;
  gap: var(--ui-space-12);
}
</style>
