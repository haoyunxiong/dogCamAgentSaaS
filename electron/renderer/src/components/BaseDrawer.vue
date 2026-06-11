<template>
  <Teleport to="body">
    <transition name="drawer">
      <div v-if="modelValue" class="drawer-overlay" @click.self="handleOverlayClick">
        <div
          class="drawer-panel anim-slide-in-right"
          :style="{ width: drawerWidth }"
        >
          <div class="drawer-header">
            <div class="drawer-heading">
              <h2 class="drawer-title">{{ title }}</h2>
              <p v-if="subtitle" class="drawer-subtitle">{{ subtitle }}</p>
            </div>
            <button class="drawer-close-btn" @click="close" aria-label="关闭" title="关闭">
              ✕
            </button>
          </div>
          <div class="drawer-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="drawer-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  width: { type: [String, Number], default: 640 },
  closeOnOverlay: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'close'])

const drawerWidth = typeof props.width === 'number' ? `${props.width}px` : props.width

function handleOverlayClick() {
  if (props.closeOnOverlay) close()
}

function close() {
  emit('update:modelValue', false)
  emit('close')
}
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(16, 24, 40, 0.32);
  display: flex;
  justify-content: flex-end;
}
.drawer-panel {
  height: 100%;
  max-width: calc(100vw - 32px);
  background: var(--bg-surface, #fff);
  box-shadow: var(--shadow-popover, 0 12px 32px rgba(16,24,40,0.12));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle, #e5e7eb);
  flex-shrink: 0;
}
.drawer-heading {
  min-width: 0;
}
.drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-strong, #17211d);
  margin: 0;
}
.drawer-subtitle {
  margin: 3px 0 0;
  color: var(--text-muted, #6f8078);
  font-size: 12px;
  line-height: 1.4;
}
.drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px;
}
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-subtle, #e5e7eb);
  flex-shrink: 0;
}

/* 过渡动画 */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity var(--duration-normal, 160ms) var(--ease-standard, ease);
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  background: transparent;
  color: var(--text-secondary, #52615b);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.drawer-close-btn:hover {
  background: var(--bg-subtle, #f3f4f6);
  border-color: var(--border-subtle, #e5e7eb);
}
</style>
