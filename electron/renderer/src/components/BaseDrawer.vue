<template>
  <Teleport to="body">
    <transition name="drawer">
      <div
        v-if="modelValue"
        class="drawer-overlay"
        :data-testid="`${testId}-overlay`"
        @click.self="handleOverlayClick"
      >
        <div
          class="drawer-panel anim-slide-in-right"
          :class="[`drawer-panel--${placement}`]"
          :style="{ width: drawerWidth }"
          :data-testid="`${testId}-panel`"
          role="dialog"
          aria-modal="true"
          :aria-label="title || '详情抽屉'"
        >
          <div class="drawer-header">
            <slot name="header">
              <div class="drawer-heading">
                <h2 class="drawer-title">{{ title }}</h2>
                <p v-if="subtitle" class="drawer-subtitle">{{ subtitle }}</p>
              </div>
            </slot>
            <button
              class="drawer-close-btn"
              type="button"
              :aria-label="closeLabel"
              :data-testid="`${testId}-close`"
              title="关闭"
              @click.stop="close"
            >
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
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  width: { type: [String, Number], default: 640 },
  placement: {
    type: String,
    default: 'right',
    validator: (v) => ['right', 'bottom'].includes(v),
  },
  closeOnOverlay: { type: Boolean, default: true },
  testId: { type: String, default: 'base-drawer' },
})

const emit = defineEmits(['update:modelValue', 'close'])

const drawerWidth = computed(() => props.placement === 'bottom'
  ? '100%'
  : (typeof props.width === 'number' ? `${props.width}px` : props.width)
)
const closeLabel = computed(() => props.title ? `关闭${props.title}` : '关闭抽屉')

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
  align-items: stretch;
}
.drawer-panel {
  height: 100%;
  max-width: calc(100vw - 32px);
  background: var(--color-surface, #fff);
  box-shadow: var(--shadow-floating, 0 12px 32px rgba(16,24,40,0.12));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-panel--bottom {
  align-self: flex-end;
  height: auto;
  max-height: min(82vh, 720px);
  max-width: none;
  border-radius: var(--radius-16, 16px) var(--radius-16, 16px) 0 0;
}

.drawer-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12, 12px);
  padding: var(--space-16, 16px) var(--space-20, 20px);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
  background: var(--color-surface, #fff);
}
.drawer-heading {
  min-width: 0;
}
.drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text, #111827);
  margin: 0;
}
.drawer-subtitle {
  margin: 3px 0 0;
  color: var(--color-text-muted, #6b7280);
  font-size: 12px;
  line-height: 1.4;
}
.drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--space-20, 20px);
}
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-token-8, 8px);
  padding: var(--space-12, 12px) var(--space-20, 20px);
  border-top: 1px solid var(--color-border, #e5e7eb);
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
  position: relative;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  background: transparent;
  color: var(--color-text-secondary, #4b5563);
  border: 1px solid transparent;
  border-radius: var(--radius-8, 8px);
  cursor: pointer;
  font-size: 14px;
}
.drawer-close-btn:hover {
  background: var(--bg-subtle, #f3f4f6);
  border-color: var(--color-border, #e5e7eb);
}
</style>
