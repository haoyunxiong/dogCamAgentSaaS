<template>
  <div class="row-action-menu">
    <button ref="triggerRef" type="button" class="btn btn-secondary btn-sm" @click.stop="toggleOpen">{{ label }}</button>
    <Teleport to="body">
      <div v-if="open" ref="panelRef" class="row-action-menu__panel" :style="panelStyle" @click.stop>
        <button
          v-for="item in items"
          :key="item.key"
          type="button"
          class="row-action-menu__item"
          :class="{ danger: item.danger }"
          :disabled="item.disabled"
          @click.stop="handleSelect(item)"
        >
          {{ item.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: '更多' },
})

const emit = defineEmits(['select'])
const open = ref(false)
const triggerRef = ref(null)
const panelRef = ref(null)
const panelStyle = ref({})

function updatePanelPosition() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const width = 156
  const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
  const top = Math.min(rect.bottom + 6, window.innerHeight - 12)
  panelStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    minWidth: `${width}px`,
  }
}

async function toggleOpen() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  updatePanelPosition()
}

function handleSelect(item) {
  open.value = false
  emit('select', item)
}

function handleDocumentClick(event) {
  const trigger = triggerRef.value
  const panel = panelRef.value
  const target = event.target
  if (trigger?.contains(target) || panel?.contains(target)) return
  open.value = false
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', updatePanelPosition)
  window.addEventListener('scroll', handleDocumentClick, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', updatePanelPosition)
  window.removeEventListener('scroll', handleDocumentClick, true)
})
</script>

<style scoped>
.row-action-menu {
  position: relative;
}

.row-action-menu__panel {
  position: fixed;
  z-index: 200;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  background: #fff;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.14);
}

.row-action-menu__item {
  display: flex;
  width: 100%;
  align-items: center;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--text-primary, #111827);
  font-size: 13px;
  text-align: left;
}

.row-action-menu__item:hover {
  background: var(--bg-subtle, #f3f4f6);
}

.row-action-menu__item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.row-action-menu__item.danger {
  color: #b91c1c;
}
</style>
