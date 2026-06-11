<template>
  <div ref="rootRef" class="rent-days-input" :class="{ open: menuOpen, disabled }">
    <div class="rent-days-control" @click="openMenu">
      <input
        ref="inputRef"
        class="rent-days-field"
        :value="localValue"
        :disabled="disabled"
        :placeholder="placeholder"
        inputmode="numeric"
        @focus="openMenu"
        @input="handleInput"
        @keydown.esc.prevent="closeMenu"
      />
      <span v-if="localValue" class="rent-days-suffix">天</span>
      <span class="rent-days-caret">▾</span>
    </div>

    <div v-if="menuOpen" class="rent-days-menu cardish">
      <button
        v-for="option in suggestions"
        :key="option.value"
        class="rent-days-option"
        type="button"
        @mousedown.prevent="selectSuggestion(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { buildRentDaySuggestions, normalizeRentDayInput } from './rentalFieldUtils.js'

const props = defineProps({
  modelValue: { type: [Number, String], default: '' },
  placeholder: { type: String, default: '输入或选择天数' },
  suggestionMax: { type: Number, default: 30 },
  minValue: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const rootRef = ref(null)
const inputRef = ref(null)
const menuOpen = ref(false)
const localValue = ref(props.modelValue === '' || props.modelValue == null ? '' : String(props.modelValue))

const suggestions = computed(() => buildRentDaySuggestions(props.suggestionMax))

watch(
  () => props.modelValue,
  (nextValue) => {
    const nextText = nextValue === '' || nextValue == null ? '' : String(nextValue)
    if (nextText !== localValue.value) localValue.value = nextText
  },
)

function emitNormalized(rawValue) {
  const normalized = normalizeRentDayInput(rawValue, props.minValue)
  emit('update:modelValue', normalized ?? '')
}

function handleInput(event) {
  localValue.value = event.target.value
  emitNormalized(localValue.value)
  menuOpen.value = true
}

function openMenu() {
  if (props.disabled) return
  menuOpen.value = true
  inputRef.value?.focus({ preventScroll: true })
}

function closeMenu() {
  menuOpen.value = false
}

function selectSuggestion(value) {
  localValue.value = String(value)
  emit('update:modelValue', value)
  closeMenu()
}

function handlePointerDown(event) {
  if (!rootRef.value?.contains(event.target)) closeMenu()
}

document.addEventListener('mousedown', handlePointerDown)
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handlePointerDown)
})
</script>

<style scoped>
.rent-days-input {
  position: relative;
  width: 100%;
}

.rent-days-control {
  position: relative;
  width: 100%;
  cursor: text;
}

.rent-days-field {
  width: 100%;
  padding-right: 54px;
}

.rent-days-suffix {
  position: absolute;
  top: 50%;
  right: 28px;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 13px;
  pointer-events: none;
}

.rent-days-caret {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  color: var(--text-faint);
  font-size: 11px;
  pointer-events: none;
}

.rent-days-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  width: min(100%, 320px);
  padding: 10px;
  border-radius: var(--radius-md);
}

.rent-days-option {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.rent-days-option:hover {
  background: var(--bg-primary-soft);
  border-color: var(--border-strong);
}

.disabled .rent-days-control {
  cursor: not-allowed;
}
</style>
